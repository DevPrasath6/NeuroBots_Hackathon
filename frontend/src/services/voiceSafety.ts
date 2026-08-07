import { dataService } from './dataService';
import { toast } from '../hooks/use-toast';

export interface SafetyAlert {
  id: string;
  priority: 1 | 2 | 3; // 1: Info, 2: Warning, 3: Critical
  title: string;
  message: string;
  aiConfidence: number;
  correctiveAction: string;
  timestamp: Date;
  resolvedTime?: Date;
  acknowledged: boolean;
  category?: string;
  status: 'new' | 'active' | 'acknowledged' | 'resolved' | 'closed';
  val?: number;
}

export interface VoiceSettings {
  enabled: boolean;
  volume: number;
  rate: number;
  gender: 'male' | 'female';
  accent: string;
  lang: string;
  repeatInterval: number; // in seconds, default 15
}

type AlertListener = (alerts: SafetyAlert[]) => void;
type SettingsListener = (settings: VoiceSettings) => void;

interface QueuedUtterance {
  text: string;
  priority: 1 | 2 | 3;
  duplicateKey?: string;
}

// Accent translation codes map (en-US or en-GB strictly for English TTS)
const ACCENT_TO_LANG_MAP: Record<string, string> = {
  'US': 'en-US',
  'GB': 'en-GB',
  'ES': 'en-US', // Spanish accent style for English text
  'FR': 'en-GB', // French accent style for English text
  'DE': 'en-US'  // German accent style for English text
};

// JS Helper to convert any number/decimal into words for premium human-like voice synthesis
export function convertNumberToWords(num: number): string {
  if (num === 0) return 'zero';
  
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 
                 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const scales = ['', 'thousand', 'million'];

  const convertThreeDigits = (val: number): string => {
    let str = '';
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + ' hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
      if (val > 0) {
        str += ones[val] + ' ';
      }
    } else if (val > 0) {
      str += ones[val] + ' ';
    }
    return str.trim();
  };

  let sign = '';
  if (num < 0) {
    sign = 'minus ';
    num = Math.abs(num);
  }

  // Handle decimals
  if (num % 1 !== 0) {
    const parts = num.toFixed(2).split('.');
    const integerPart = parseInt(parts[0], 10);
    const decimalPart = parts[1];
    
    const integerWords = integerPart === 0 ? 'zero' : convertNumberToWords(integerPart);
    const decimalWords = decimalPart.split('').map(digit => {
      const d = parseInt(digit, 10);
      return ones[d] || 'zero';
    }).join(' ');
    
    return `${sign}${integerWords} point ${decimalWords}`.trim();
  }

  let word = '';
  let scaleIndex = 0;
  let remaining = num;

  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkStr = convertThreeDigits(chunk);
      word = chunkStr + (scales[scaleIndex] ? ' ' + scales[scaleIndex] : '') + ' ' + word;
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex++;
  }

  return `${sign}${word.trim()}`;
}

export function replaceNumbersWithWords(text: string): string {
  // Regex to match integer and decimal numbers
  return text.replace(/\b\d+(\.\d+)?\b/g, (match) => {
    const num = parseFloat(match);
    if (!isNaN(num)) {
      return convertNumberToWords(num);
    }
    return match;
  });
}

class VoiceSafetyService {
  private alerts: SafetyAlert[] = [];
  private settings: VoiceSettings = {
    enabled: true,
    volume: 0.8,
    rate: 1.0,
    gender: 'female',
    accent: 'US',
    lang: 'en-US',
    repeatInterval: 15
  };

  private alertListeners: Set<AlertListener> = new Set();
  private settingsListeners: Set<SettingsListener> = new Set();
  private repeatIntervals: Map<string, any> = new Map();
  private lastSpokenTime: Map<string, number> = new Map();
  private anomalyVoiceCount: number = 0;
  private spokenKeys: Set<string> = new Set();

  // Custom priority-based voice queue parameters
  private queue: QueuedUtterance[] = [];
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activePriority: number = 0;
  private cachedOperatorId: string | null = null;

  public resetCycle() {
    this.anomalyVoiceCount = 0;
    this.spokenKeys.clear();
    this.lastSpokenTime.clear();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.queue = [];
    this.activeUtterance = null;
    this.activePriority = 0;
    this.alerts = [];
    this.notifyAlerts();
  }

  constructor() {
    // Load settings from localStorage if available
    try {
      const stored = localStorage.getItem('metallisense_voice_settings');
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load voice settings', e);
    }
  }

  // Find operator op_watas database ID to store audit log activities correctly
  private async getOperatorUuid(): Promise<string | null> {
    if (this.cachedOperatorId) return this.cachedOperatorId;
    try {
      const res = await fetch('/api/operators/');
      if (res.ok) {
        const data = await res.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        const op = results.find((o: any) => o.username === 'op_watas') || results[0];
        if (op) {
          this.cachedOperatorId = op.id;
          return op.id;
        }
      }
    } catch (e) {
      console.error('Failed to resolve operator UUID', e);
    }
    return null;
  }

  // Log spoken voice activities to SQL database via django REST framework activities endpoint
  private async logVoiceActivity(text: string, priority: number) {
    try {
      const opId = await this.getOperatorUuid();
      if (!opId) return;

      await fetch('/api/activities/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator: opId,
          action: `Voice Alert Level ${priority}: "${text}"`
        })
      });
    } catch (e) {
      console.error('Failed to write activity audit log', e);
    }
  }

  // --- Listeners ---
  public subscribeToAlerts(listener: AlertListener): () => void {
    this.alertListeners.add(listener);
    listener([...this.alerts]);
    return () => { this.alertListeners.delete(listener); };
  }

  public subscribeToSettings(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    listener({ ...this.settings });
    return () => { this.settingsListeners.delete(listener); };
  }

  private notifyAlerts() {
    const list = [...this.alerts];
    this.alertListeners.forEach(l => l(list));
  }

  private notifySettings() {
    const s = { ...this.settings };
    this.settingsListeners.forEach(l => l(s));
  }

  // --- Voice Settings API ---
  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...updates };

    // Synchronize accent to language code automatically (strictly English TTS)
    if (updates.accent && ACCENT_TO_LANG_MAP[updates.accent]) {
      this.settings.lang = ACCENT_TO_LANG_MAP[updates.accent];
    }

    try {
      localStorage.setItem('metallisense_voice_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.error(e);
    }
    this.notifySettings();
  }

  // --- Speak Utterance (Priority queue manager) ---
  public speak(text: string, priority: 1 | 2 | 3, duplicateKey?: string) {
    const key = duplicateKey || text;
    
    // Check if resolution or anomaly
    const isResolution = text.toLowerCase().includes("restored") ||
                         text.toLowerCase().includes("resolved") ||
                         text.toLowerCase().includes("returned") ||
                         text.toLowerCase().includes("normal") ||
                         text.toLowerCase().includes("continue");
    
    const isAnomaly = priority >= 2;

    if (!isAnomaly && !isResolution) {
      // Remain completely silent during normal operations
      return;
    }

    if (!this.settings.enabled) {
      return;
    }

    // Limit voice alerts to maximum of 2 per batch
    if (this.anomalyVoiceCount >= 2) {
      // Only allow completely new priority 3 critical alerts to pass through
      if (priority !== 3 || this.spokenKeys.has(key)) {
        return;
      }
    }

    // Prevent speaking duplicate keys in the current cycle
    if (this.spokenKeys.has(key)) {
      return;
    }

    this.spokenKeys.add(key);
    this.anomalyVoiceCount++;

    const now = Date.now();
    let cooldown = 15000; // default 15s

    // Set custom cooldown periods
    if (key.includes("Overheating") || key.includes("Temperature")) {
      cooldown = 45000;
    } else if (key.includes("Deviation") || key.includes("Spectrometer")) {
      cooldown = 60000;
    } else if (key.includes("Inventory") || key.includes("Shortage")) {
      cooldown = 1800000;
    }

    // Deduplication cooldown check
    if (priority !== 3) {
      const last = this.lastSpokenTime.get(key) || 0;
      if (now - last < cooldown) {
        return;
      }
      this.lastSpokenTime.set(key, now);
    }

    // Critical interrupt handling (Level 3 immediately cancels lower priority and empties queue)
    if (priority === 3) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      this.activeUtterance = null;
      this.activePriority = 0;
      this.queue = this.queue.filter(q => q.priority === 3);
      this.speakUtterance(text, priority);
    } else {
      this.queue.push({ text, priority, duplicateKey });
      this.processQueue();
    }
  }

  // Process next queue items in order of priority level
  private processQueue() {
    if (this.activeUtterance) {
      return; // currently speaking
    }
    if (this.queue.length === 0) {
      return;
    }

    const next = this.queue.shift();
    if (next) {
      this.speakUtterance(next.text, next.priority);
    }
  }

  private speakUtterance(text: string, priority: number) {
    if (!window.speechSynthesis) return;

    // Filter text block: strictly English text output
    const rawText = text.replace(/[^\x00-\x7F]/g, "").trim();
    if (!rawText) return;

    const utterance = new SpeechSynthesisUtterance(rawText);
    utterance.volume = this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    const accentKeywords = this.settings.accent ? [this.settings.accent.toLowerCase()] : ['en-us', 'en-gb', 'google US English', 'microsoft zira'];
    const genderKeywords = this.settings.gender === 'female' ? ['female', 'zira', 'hazel', 'susan', 'heera'] : ['male', 'david', 'mark', 'george', 'ravi'];

    // Select suitable matching synthesized voice
    selectedVoice = voices.find(v => 
      accentKeywords.some(keyword => v.name.toLowerCase().includes(keyword) || v.lang.toLowerCase().includes(keyword)) &&
      genderKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
    );

    const candidateVoices = voices.filter(v => 
      genderKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
    );

    if (!selectedVoice && candidateVoices.length > 0) {
      selectedVoice = candidateVoices[0];
    }
    
    if (!selectedVoice && voices.length > 0) {
      selectedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      this.activeUtterance = utterance;
      this.activePriority = priority;
    };

    utterance.onend = () => {
      this.activeUtterance = null;
      this.activePriority = 0;
      this.processQueue();
    };

    utterance.onerror = () => {
      this.activeUtterance = null;
      this.activePriority = 0;
      this.processQueue();
    };

    this.logVoiceActivity(rawText, priority);
    window.speechSynthesis.speak(utterance);
  }

  // --- Alert Trigger Engine ---
  public triggerAlert(
    title: string,
    message: string,
    priority: 1 | 2 | 3,
    aiConfidence: number = 95.0,
    correctiveAction: string = "Monitor furnace parameters.",
    category: string = "Safety",
    val?: number
  ) {
    // Only trigger alerts and visual popups for anomalies or resolution events
    const isResolution = title.toLowerCase().includes("resolved") || 
                         title.toLowerCase().includes("restored") || 
                         title.toLowerCase().includes("normal") ||
                         message.toLowerCase().includes("resolved") ||
                         message.toLowerCase().includes("restored") ||
                         message.toLowerCase().includes("normal") ||
                         message.toLowerCase().includes("returned") ||
                         message.toLowerCase().includes("continue");
    
    const isAnomaly = priority >= 2;

    if (!isAnomaly && !isResolution) {
      // Silence normal workflow triggers completely: no voice, no popup, no announcements, no DB log
      return;
    }

    const existingIndex = this.alerts.findIndex(a => a.title === title && a.status !== 'resolved' && a.status !== 'closed');
    if (existingIndex !== -1) {
      const existing = this.alerts[existingIndex];
      
      if (val !== undefined && existing.val !== undefined) {
        const diff = Math.abs(val - existing.val);
        if (title.includes("Overheating") || title.includes("Temperature")) {
          if (diff < 20) {
            return;
          }
        } else if (diff < 0.05) {
          return;
        }
      } else {
        return;
      }

      existing.message = message;
      existing.val = val;
      existing.timestamp = new Date();
      existing.status = 'active';
      this.notifyAlerts();
      this.speak(message, priority, title);
      return;
    }

    const newAlert: SafetyAlert = {
      id: crypto.randomUUID(),
      priority,
      title,
      message,
      aiConfidence,
      correctiveAction,
      timestamp: new Date(),
      acknowledged: false,
      category,
      status: 'new',
      val
    };

    this.alerts = [newAlert, ...this.alerts];
    this.notifyAlerts();

    const severityMap: Record<number, 'low' | 'medium' | 'high' | 'critical'> = {
      1: 'low',
      2: 'medium',
      3: 'critical'
    };
    dataService.createAlert({
      title: newAlert.title,
      message: newAlert.message,
      severity: severityMap[priority],
      source: 'Voice Safety AI'
    });

    const alertPrefix = priority === 3 ? "Critical warning. " : (priority === 2 ? "Warning. " : "");
    this.speak(`${alertPrefix}${message}`, priority, title);

    if (priority === 3) {
      let repeatTime = this.settings.repeatInterval;
      if (title.includes("Overheating") || title.includes("Temperature")) {
        repeatTime = 60;
      } else if (title.includes("Deviation") || title.includes("Spectrometer")) {
        repeatTime = 90;
      }

      const intervalId = setInterval(() => {
        const currentAlert = this.alerts.find(a => a.id === newAlert.id);
        if (currentAlert && currentAlert.status !== 'resolved' && currentAlert.status !== 'closed' && !currentAlert.acknowledged && this.settings.enabled) {
          this.speak(`Critical warning. ${message}`, 3);
        }
      }, repeatTime * 1000);

      this.repeatIntervals.set(newAlert.id, intervalId);
    }
  }

  // --- Resolve Alert ---
  public resolveAlert(title: string) {
    let resolvedAny = false;

    this.alerts = this.alerts.map(alert => {
      if (alert.title === title && alert.status !== 'resolved' && alert.status !== 'closed') {
        const intervalId = this.repeatIntervals.get(alert.id);
        if (intervalId) {
          clearInterval(intervalId);
          this.repeatIntervals.delete(alert.id);
        }
        
        resolvedAny = true;
        return {
          ...alert,
          status: 'resolved' as const,
          resolvedTime: new Date(),
          acknowledged: true
        };
      }
      return alert;
    });

    if (resolvedAny) {
      // Stop safety speech immediately and clear speech queues
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      this.activeUtterance = null;
      this.activePriority = 0;
      this.queue = [];

      // Output specific resolution text
      if (title.toLowerCase().includes("overheating") || title.toLowerCase().includes("temperature")) {
        this.speak("Temperature restored. Production may continue.", 1, "temp_normal");
      } else if (title.toLowerCase().includes("composition")) {
        this.speak("Composition restored. Production may continue.", 1, "comp_normal");
      } else {
        this.speak(`${title} resolved. Production may continue.`, 1, `${title}_resolved`);
      }
      this.notifyAlerts();
    }
  }

  // --- Acknowledge Alert ---
  public acknowledgeAlert(id: string) {
    this.alerts = this.alerts.map(alert => {
      if (alert.id === id) {
        const intervalId = this.repeatIntervals.get(id);
        if (intervalId) {
          clearInterval(intervalId);
          this.repeatIntervals.delete(id);
        }
        
        if (alert.status !== 'acknowledged') {
          this.speak("Alert acknowledged.", 2);
        }
        return { ...alert, status: 'acknowledged' as const, acknowledged: true };
      }
      return alert;
    });

    this.notifyAlerts();
  }

  public getActiveAlerts(): SafetyAlert[] {
    return this.alerts.filter(a => a.status === 'new' || a.status === 'active' || (a.priority === 3 && !a.acknowledged));
  }
}

export const voiceSafetyService = new VoiceSafetyService();
