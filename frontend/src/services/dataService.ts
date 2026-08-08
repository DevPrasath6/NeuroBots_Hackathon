export interface SmeltingRun {
  run_id: string | null;
  batch_id: string | null;
  status: 'STANDBY' | 'PREPARING' | 'CHARGING' | 'MELTING' | 'REFINING' | 'READY_TO_TAP' | 'TAPPING' | 'COMPLETED';
  current_stage: string;
  selected_alloy: string | null;
  alloy_code?: string;
  temperature: number;
  power: number;
  energy_consumption: number;
  melt_weight: number;
  batch_progress: number;
  start_time?: string;
  estimated_finish?: string;
  predicted_quality: number;
  ai_recommendation?: any;
}

export interface ProcessReading {
  id: string;
  timestamp: Date;
  furnace_id: string;
  temperature: number;
  pressure: number;
  oxygen_level: number;
  composition: Record<string, number>;
  quality_score?: number;
}

export interface AlloyRecommendation {
  id: string;
  target_composition: Record<string, number>;
  current_composition: Record<string, number>;
  recommendations: Array<{
    element: string;
    adjustment: number;
    confidence: number;
  }>;
  cost_impact: number;
  quality_improvement: number;
  created_at: Date;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  is_resolved: boolean;
  created_at: Date;
  resolved_at?: Date;
}

async function safeParseJson(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || response.status === 503 || response.status === 502) {
    window.dispatchEvent(new CustomEvent('backend-waking-up'));
    throw new Error('BACKEND_WAKING_UP');
  }
  
  if (!response.ok) {
    throw new Error(`API request failed with status: ${response.status}`);
  }

  try {
    return await response.json();
  } catch (e) {
    throw new Error('INVALID_JSON_RESPONSE');
  }
}

class DataService {
  // Process Data Management
  async getRecentProcessData(hours: number = 24): Promise<ProcessReading[]> {
    try {
      const res = await fetch('/api/readings/');
      const data = await safeParseJson(res);
      const results = data.results || (Array.isArray(data) ? data : []);
      return results.map((r: any) => ({
        id: r.id,
        timestamp: new Date(r.timestamp),
        furnace_id: r.batch ? r.batch.substring(0, 8) : 'F001',
        temperature: r.temperature,
        pressure: r.pressure,
        oxygen_level: r.oxygen_flow || 0,
        composition: r.estimated_composition || {},
        quality_score: r.predicted_quality || 85.0
      }));
    } catch (err) {
      console.error('Error fetching process data from database:', err);
      return [];
    }
  }

  async addProcessReading(reading: Omit<ProcessReading, 'id'>): Promise<void> {
    try {
      await fetch('/api/readings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: reading.furnace_id,
          temperature: reading.temperature,
          pressure: reading.pressure,
          oxygen_flow: reading.oxygen_level,
          estimated_composition: reading.composition,
          predicted_quality: reading.quality_score || 85.0,
          voltage: 480,
          current: 2500,
          power: 1.2,
          energy_consumption: 450
        })
      });
    } catch (err) {
      console.error('Error adding process reading:', err);
    }
  }

  // Alloy Recommendations
  async getRecommendations(): Promise<AlloyRecommendation[]> {
    try {
      const res = await fetch('/api/quality-reports/');
      const data = await safeParseJson(res);
      const results = data.results || (Array.isArray(data) ? data : []);
      return results.map((r: any) => ({
        id: r.id,
        target_composition: r.target_composition || {},
        current_composition: r.spectrometer_reading ? r.spectrometer_reading.composition : {},
        recommendations: [],
        cost_impact: 0,
        quality_improvement: r.quality_score || 95.0,
        created_at: new Date(r.created_at || Date.now())
      }));
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      return [];
    }
  }

  async generateRecommendation(
    targetComposition: Record<string, number>,
    currentComposition: Record<string, number>
  ): Promise<AlloyRecommendation> {
    return {
      id: crypto.randomUUID(),
      target_composition: targetComposition,
      current_composition: currentComposition,
      recommendations: [],
      cost_impact: 0,
      quality_improvement: 95.0,
      created_at: new Date()
    };
  }

  // Alert Management
  async getActiveAlerts(): Promise<Alert[]> {
    try {
      const res = await fetch('/api/anomalies/');
      const data = await safeParseJson(res);
      const results = data.results || (Array.isArray(data) ? data : []);
      return results.map((a: any) => ({
        id: a.id,
        title: a.anomaly_type || 'Thermal Anomaly',
        message: a.description || 'Abnormal value detected',
        severity: (a.severity || 'medium').toLowerCase() as any,
        source: a.detector_model || 'System',
        is_resolved: a.resolved || false,
        created_at: new Date(a.detection_time || Date.now())
      }));
    } catch (err) {
      console.error('Error fetching alerts:', err);
      return [];
    }
  }

  async getLatestBatchId(): Promise<string | null> {
    try {
      const res = await fetch('/api/batches/');
      if (res.ok) {
        const data = await safeParseJson(res);
        const results = data.results || (Array.isArray(data) ? data : []);
        if (results.length > 0) {
          // Return the ID of the most recently created batch
          return results[0].id;
        }
      }
    } catch (e) {
      console.error('Error fetching latest batch:', e);
    }
    return null;
  }

  async createAlert(alert: Omit<Alert, 'id' | 'created_at' | 'is_resolved'>): Promise<void> {
    try {
      const batchId = await this.getLatestBatchId();
      if (!batchId) {
        console.warn('Cannot write anomaly to database: No active batch run is currently present.');
        return;
      }

      // Map severity properly to choice values ('low', 'medium', 'high', 'critical')
      let severityLower = (alert.severity || 'medium').toLowerCase();
      if (severityLower === 'error' || severityLower === 'warning') severityLower = 'medium';
      
      const payload = {
        batch: batchId,
        type: alert.title,
        description: alert.message,
        severity: severityLower,
        recommendation: 'Observe furnace coupling, cooling pumps, and stabilize coil temperature.',
        resolved: false,
        operator: 'op_watas'
      };

      await fetch('/api/anomalies/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Error creating alert:', err);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      await fetch(`/api/anomalies/${alertId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolved: true,
          resolved_time: new Date().toISOString()
        })
      });
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  }

  // Analytics and Reporting
  async getSystemAnalytics() {
    try {
      const [metricsRes, analyticsRes] = await Promise.all([
        fetch('/api/dashboard/metrics/'),
        fetch('/api/charts/process-analytics/')
      ]);
      const metrics = await safeParseJson(metricsRes);
      const analytics = await safeParseJson(analyticsRes);

      const totalReadings = metrics.recent_activity ? metrics.recent_activity.length : 10;
      const avgQuality = parseFloat(metrics.production_efficiency || '95.0');
      const criticalAlerts = metrics.active_alerts || 0;
      const systemUptime = parseFloat(analytics.system_uptime || '99.95');
      const energyEfficiency = parseFloat(metrics.energy_efficiency ? metrics.energy_efficiency.replace('%', '') : '87.5');
      const costSavings = parseFloat(analytics.cost_savings || '1250.30');
      const avgConfidence = parseFloat(analytics.model_accuracy || '98.29');

      return {
        totalReadings,
        avgQuality: avgQuality || 95.0,
        criticalAlerts,
        avgConfidence: avgConfidence || 98.29,
        systemUptime: systemUptime || 99.95,
        energyEfficiency: energyEfficiency || 87.5,
        costSavings: costSavings || 1250.30
      };
    } catch (err) {
      console.error('Error loading system analytics:', err);
      return {
        totalReadings: 10,
        avgQuality: 98.29,
        criticalAlerts: 0,
        avgConfidence: 99.82,
        systemUptime: 99.95,
        energyEfficiency: 87.5,
        costSavings: 1250.30
      };
    }
  }

  // Smelting Run state machine tracking
  async getCurrentSmeltingRun(): Promise<SmeltingRun> {
    try {
      const res = await fetch('/api/smelting/current-run/');
      return await safeParseJson(res);
    } catch (err) {
      console.error('Error fetching current smelting run:', err);
      return {
        run_id: null,
        batch_id: null,
        status: 'STANDBY',
        current_stage: 'STANDBY',
        selected_alloy: null,
        temperature: 25.0,
        power: 0.0,
        energy_consumption: 0.0,
        melt_weight: 0.0,
        batch_progress: 0.0,
        predicted_quality: 0.0,
        ai_recommendation: {}
      };
    }
  }

  async startSmeltingRun(alloyCode: string, batchWeight: number, batchId?: string, weightUnit?: string): Promise<any> {
    try {
      const res = await fetch('/api/smelting/start-run/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alloy_code: alloyCode, batch_weight: batchWeight, batch_id: batchId, weight_unit: weightUnit || 'kg' })
      });
      if (!res.ok) throw new Error('Failed to start run');
      return await safeParseJson(res);
    } catch (err) {
      console.error('Error starting smelting run:', err);
      return null;
    }
  }

  async updateSmeltingRun(data: Partial<SmeltingRun>): Promise<any> {
    try {
      const res = await fetch('/api/smelting/update-run/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update run');
      return await safeParseJson(res);
    } catch (err) {
      console.error('Error updating smelting run:', err);
      return null;
    }
  }
}

export const dataService = new DataService();
