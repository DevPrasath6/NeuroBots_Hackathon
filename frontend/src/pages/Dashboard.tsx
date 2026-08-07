import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, ArrowRight, Sparkles, Activity, Search, Info,
  Flame, Thermometer, Zap, Wind, Gauge, AlertTriangle, 
  CheckCircle2, AlertCircle, FileText, Database, ShieldAlert,
  Archive, Award, ChevronLeft, ChevronRight, Layers, Trash2, Cpu,
  Home, HelpCircle, BookOpen, Settings2, RefreshCw, FlaskConical, Beaker
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DashboardHeader } from '@/components/DashboardHeader';
import { FurnaceMonitoring } from '@/components/FurnaceMonitoring';
import { AlloyRecommendationPanel } from '@/components/AlloyRecommendationPanel';
import { ComprehensiveDashboard } from '@/components/ComprehensiveDashboard';
import { AnomalyDetection } from '@/components/AnomalyDetection';
import { AlertPanel } from '@/components/AlertPanel';
import jsPDF from 'jspdf';
import { dataService } from '@/services/dataService';
import { voiceSafetyService, SafetyAlert } from '@/services/voiceSafety';

export const Dashboard = () => {
  // Navigation Flow State
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // Voice Safety Assistant states
  const [alertsList, setAlertsList] = useState<SafetyAlert[]>([]);
  const [voiceSettings, setVoiceSettings] = useState(voiceSafetyService.getSettings());
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);

  // Safety simulation states
  const [safetyDoorOpen, setSafetyDoorOpen] = useState(false);
  const [coolingWaterFailed, setCoolingWaterFailed] = useState(false);
  const [powerFluctuating, setPowerFluctuating] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);

  useEffect(() => {
    const unsubAlerts = voiceSafetyService.subscribeToAlerts(setAlertsList);
    const unsubSettings = voiceSafetyService.subscribeToSettings(setVoiceSettings);
    return () => {
      unsubAlerts();
      unsubSettings();
    };
  }, []);


  // Batch Config data
  const [searchQuery, setSearchQuery] = useState("");
  const [alloysList, setAlloysList] = useState<any[]>([]);
  const [selectedAlloy, setSelectedAlloy] = useState<any>({
    id: "",
    name: "Loading...",
    grade: "...",
    standard: "",
    applications: "",
    properties: "",
    composition: {}
  });
  const [batchWeight, setBatchWeight] = useState(1000); // 1000 kg/tons
  const [weightUnit, setWeightUnit] = useState<"kg" | "t">("kg");

  useEffect(() => {
    fetch('/api/alloys/')
      .then(res => res.json())
      .then(data => {
        const results = data.results || (Array.isArray(data) ? data : []);
        const mapped = results.map((item: any) => {
          const compMap: Record<string, number> = {};
          if (Array.isArray(item.compositions)) {
            item.compositions.forEach((c: any) => {
              compMap[c.element] = c.target_pct;
            });
          } else if (item.compositions && typeof item.compositions === 'object') {
            Object.assign(compMap, item.compositions);
          }
          return {
            id: item.id,
            name: item.name,
            grade: item.code,
            standard: item.standard || "Industrial Reference Standard",
            applications: item.applications || "Industrial manufacturing pipeline lining",
            properties: `Density: ${item.density || 7.8} g/cm³`,
            composition: compMap
          };
        });
        setAlloysList(mapped);
        if (mapped.length > 0) {
          setSelectedAlloy(mapped[0]);
        }
      })
      .catch(err => console.error("Error loading alloys catalog from DB:", err));
  }, []);

  const filteredAlloys = alloysList.filter(alloy => 
    alloy.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    alloy.grade.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Smelting & Spectrometer Live Loop Simulation states
  const [meltProgress, setMeltProgress] = useState(0);
  const [meltTemperature, setMeltTemperature] = useState(1350);
  const [isMeltingActive, setIsMeltingActive] = useState(false);

  // Melt state steps: 'initial_melting', 'sampling_required_1', 'oes_scan_1', 'report_1', 'melting_2', 'sampling_required_2', 'oes_scan_2', 'report_2', 'pouring', 'completed'
  const [meltSubState, setMeltSubState] = useState<string>("initial_melting");
  const [spectrometerProgress, setSpectrometerProgress] = useState(0);
  const [spectrometerStageName, setSpectrometerStageName] = useState("Idle");
  
  // Element compositions drifting / correction logs
  const [currentComposition, setCurrentComposition] = useState<Record<string, number>>({
    Fe: 68.0, Cr: 15.2, Ni: 10.1, Mo: 1.5, Mn: 0.7, Si: 0.3, C: 0.05, P: 0.04, S: 0.03
  });

  const [additionsApplied, setAdditionsApplied] = useState<string[]>([]);
  const [spectrometerScansCount, setSpectrometerScansCount] = useState(0);
  
  // Canvases
  const oesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const furnaceTwinCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pouringCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stepsList = [
    { id: 0, label: "Dashboard", short: "Dashboard" },
    { id: 1, label: "Select Alloy", short: "Alloy" },
    { id: 2, label: "Enter Batch Size", short: "Batch Size" },
    { id: 3, label: "AI Composition Calculator", short: "Calculator" },
    { id: 4, label: "Live Furnace Monitoring", short: "Monitoring" },
    { id: 5, label: "Production Report", short: "Report" }
  ];

  // Initialize composition based on selected alloy with realistic deviations
  useEffect(() => {
    if (!selectedAlloy || !selectedAlloy.composition || Object.keys(selectedAlloy.composition).length === 0) return;
    const base = { ...selectedAlloy.composition };
    // introduce 10% element deviation for initial state
    for (const el in base) {
      if (el !== "Fe") {
        base[el] = roundVal(base[el] * 0.85);
      }
    }
    setCurrentComposition(base);
    setAdditionsApplied([]);
    setSpectrometerScansCount(0);
  }, [selectedAlloy]);

  // Rotate Lattice preview on Step 1
  useEffect(() => {
    if (currentStep !== 1) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const drawLattice = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const size = 45;

      const nodes = [
        {x: -1, y: -1, z: -1}, {x: 1, y: -1, z: -1}, {x: 1, y: 1, z: -1}, {x: -1, y: 1, z: -1},
        {x: -1, y: -1, z: 1}, {x: 1, y: -1, z: 1}, {x: 1, y: 1, z: 1}, {x: -1, y: 1, z: 1}
      ];

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const projected = nodes.map(n => {
        let x1 = n.x * cos - n.z * sin;
        let z1 = n.x * sin + n.z * cos;
        let y2 = n.y * cos - z1 * sin;
        return {
          x: cx + x1 * size,
          y: cy - y2 * size
        };
      });

      ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
      ctx.lineWidth = 1;
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
      ];
      connections.forEach(([n1, n2]) => {
        ctx.beginPath();
        ctx.moveTo(projected[n1].x, projected[n1].y);
        ctx.lineTo(projected[n2].x, projected[n2].y);
        ctx.stroke();
      });

      projected.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00f3ff';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      angle += 0.015;
      animId = requestAnimationFrame(drawLattice);
    };

    drawLattice();
    return () => cancelAnimationFrame(animId);
  }, [currentStep, selectedAlloy]);

  // Voice Safety Assistant Safety Alarm Triggers
  useEffect(() => {
    if (safetyDoorOpen) {
      voiceSafetyService.triggerAlert(
        "Furnace Safety Door Open",
        "Warning. Furnace safety door is open. Please close the door immediately.",
        2,
        99.0,
        "Close the safety door to restore containment pressure and reduce thermal leakage.",
        "Safety"
      );
    }
  }, [safetyDoorOpen]);

  useEffect(() => {
    if (coolingWaterFailed) {
      voiceSafetyService.triggerAlert(
        "Cooling Interruption",
        "Critical warning. Cooling water flow interruption detected. Immediate shut down checklist required.",
        3,
        99.5,
        "Check secondary water loop pumps. Prepare to vent steam or reduce furnace power.",
        "Safety"
      );
    }
  }, [coolingWaterFailed]);

  useEffect(() => {
    if (powerFluctuating) {
      voiceSafetyService.triggerAlert(
        "Power Fluctuation",
        "Electrical power fluctuation detected. Monitoring furnace stability.",
        2,
        94.0,
        "Observe power spikes on induction coils. Prepare capacitor bank switch.",
        "Electrical"
      );
    }
  }, [powerFluctuating]);

  useEffect(() => {
    if (emergencyStop) {
      voiceSafetyService.triggerAlert(
        "Emergency Stop",
        "Emergency stop activated. Production has been safely halted.",
        3,
        100.0,
        "Initiate emergency venting and isolate induction power immediately.",
        "Safety"
      );
      setIsMeltingActive(false);
    }
  }, [emergencyStop]);

  // Voice Safety Assistant Production Milestones & Workflow speech
  useEffect(() => {
    if (currentStep === 1) {
      voiceSafetyService.triggerAlert(
        "Alloy Selection Mode",
        "Please select the target steel alloy grade.",
        1,
        95.0,
        "Choose an alloy grade from the catalog.",
        "Workflow"
      );
      // Cost Optimization recommendation alert
      setTimeout(() => {
        voiceSafetyService.triggerAlert(
          "AI Grade Recommendation",
          "AI recommends using Alloy 4140 instead of Alloy 4340 to reduce material cost by eight percent while maintaining required mechanical properties.",
          1,
          94.0,
          "Select Alloy 4140 to optimize production cost by 8% or continue with 4340.",
          "Optimization"
        );
      }, 3000);
    } else if (currentStep === 2) {
      voiceSafetyService.triggerAlert(
        "Batch Configuration Mode",
        "Please enter the total batch size target weight.",
        1,
        95.0,
        "Specify the target batch weight in the input field.",
        "Workflow"
      );
    } else if (currentStep === 3) {
      voiceSafetyService.triggerAlert(
        "Recipe Calculated",
        "Recipe calculation completed.",
        1,
        99.0,
        "Verify raw materials addition weights.",
        "Workflow"
      );
      
      // Start interactive guided charging simulation
      setGuidedStep(1);
      setTimeout(() => {
        voiceSafetyService.speak("Next material recommendation. Add 175 kilograms of ferrochrome.", 1, "recommend_ferrochrome");
      }, 2000);

      // Inventory shortage triggers during charge calculations
      setTimeout(() => {
        voiceSafetyService.triggerAlert(
          "Inventory Shortage Alert",
          "Inventory alert. Nickel stock is insufficient to complete the selected recipe.",
          2,
          96.0,
          "Stock levels low. Reorder Nickel or switch to alternative recipe.",
          "Inventory"
        );
      }, 5000);
      setTimeout(() => {
        voiceSafetyService.triggerAlert(
          "Alternative Recipe Advice",
          "An alternative production recipe is available using existing inventory.",
          1,
          98.0,
          "Evaluate alternative recipe with available stock.",
          "Inventory"
        );
      }, 10000);

    } else if (currentStep === 4) {
      if (meltSubState === "initial_melting") {
        if (meltProgress === 0) {
          voiceSafetyService.triggerAlert(
            "Melting Initiated",
            "Material charging completed. Melting has started.",
            1,
            99.0,
            "Monitor digital twin and temperature indicators.",
            "Workflow"
          );
        }
      } else if (meltSubState === "sampling_required_1") {
        voiceSafetyService.triggerAlert(
          "Sample Required",
          "First melt progress target achieved. Spectrometer analysis is required.",
          2,
          98.5,
          "Extract molten sample and insert in OES Chamber.",
          "Spectrometer"
        );
      } else if (meltSubState === "oes_scan_1") {
        voiceSafetyService.triggerAlert(
          "OES Analysis Running",
          "Spectrometer analysis in progress.",
          1,
          99.0,
          "Wait for spectrometer blue laser scanning sweep.",
          "Spectrometer"
        );
      } else if (meltSubState === "report_1") {
        const crTarget = selectedAlloy.composition.Cr || 0;
        const crActual = currentComposition.Cr || 0;
        if (crActual < crTarget) {
          const deficit = (crTarget - crActual).toFixed(2);
          const additionKg = Math.round(5.8 * batchWeight / 100);
          voiceSafetyService.triggerAlert(
            "Composition Deviation", 
            `Spectrometer analysis complete. Chromium concentration is below the target specification by ${deficit} percent. Recommended correction: Add ${additionKg} kilograms of ferrochromium.`, 
            2, 
            99.2, 
            `Add ${additionKg} kg of Ferrochrome raw material trim.`, 
            "Spectrometer"
          );
        }
      } else if (meltSubState === "melting_2") {
        voiceSafetyService.triggerAlert(
          "Refining Initiated",
          "Refining process initiated. Re-heating furnace.",
          1,
          99.0,
          "Stabilizing furnace temperature.",
          "Workflow"
        );
      } else if (meltSubState === "sampling_required_2") {
        voiceSafetyService.triggerAlert(
          "Sample Required",
          "Refining heat complete. Final spectrometer verification required.",
          2,
          98.5,
          "Extract second molten sample for confirmation.",
          "Spectrometer"
        );
      } else if (meltSubState === "oes_scan_2") {
        voiceSafetyService.triggerAlert(
          "OES Analysis Running",
          "Spectrometer analysis in progress.",
          1,
          99.0,
          "Running final composition check.",
          "Spectrometer"
        );
      } else if (meltSubState === "report_2") {
        const niTarget = selectedAlloy.composition.Ni || 0;
        const niActual = currentComposition.Ni || 0;
        if (niActual < niTarget) {
          const deficit = (niTarget - niActual).toFixed(2);
          const additionKg = Math.round(4.2 * batchWeight / 100);
          voiceSafetyService.triggerAlert(
            "Composition Deviation", 
            `Spectrometer analysis complete. Nickel concentration is below the target specification by ${deficit} percent. Recommended correction: Add ${additionKg} kilograms of nickel.`, 
            2, 
            99.2, 
            `Add ${additionKg} kg of Nickel raw material trim.`, 
            "Spectrometer"
          );
        } else {
          voiceSafetyService.triggerAlert(
            "Composition Accepted",
            "Spectrometer verification successful. Alloy composition is within specification.",
            1,
            99.5,
            "Prepare ladle for tapping.",
            "Spectrometer"
          );
        }
      } else if (meltSubState === "pouring") {
        voiceSafetyService.triggerAlert(
          "Tapping Started",
          "Tapping has started.",
          1,
          99.0,
          "Discharging melt into transporter.",
          "Workflow"
        );
      } else if (meltSubState === "completed") {
        voiceSafetyService.triggerAlert(
          "Batch Completed",
          "Production batch completed successfully. Quality inspection passed.",
          1,
          99.8,
          "Archive quality certificate and clear crucible.",
          "Workflow"
        );
      }
    } else if (currentStep === 5) {
      voiceSafetyService.triggerAlert(
        "Report Generated",
        "Production report generated.",
        1,
        99.0,
        "Download PDF audit report.",
        "Workflow"
      );
    }
  }, [currentStep, meltSubState]);

  // Temperature Speech alerts listener
  useEffect(() => {
    if (currentStep !== 4) return;
    
    // Critical Overheat Alarm
    if (meltTemperature > 1650) {
      voiceSafetyService.triggerAlert(
        "Furnace Overheating",
        `Critical warning. Furnace temperature has exceeded the recommended operating limit. Current temperature is ${Math.round(meltTemperature)} degrees Celsius. Please reduce furnace power or begin corrective action.`,
        3,
        98.0,
        "Immediately reduce furnace power setting. Verify cooling water flow is normal.",
        "Temperature",
        meltTemperature
      );
    }
    // Rapid Temperature rise alarm
    else if (isMeltingActive && meltTemperature > 1150 && meltTemperature < 1250) {
      voiceSafetyService.triggerAlert(
        "Rapid Temp Increase",
        "Critical warning. Rapid temperature increase detected. Potential overheating condition. Immediate operator attention is required.",
        3,
        97.5,
        "Observe power spikes on induction coils. Prepare capacitor bank switch.",
        "Temperature",
        meltTemperature
      );
    }
    // Normal restoration
    else if (meltTemperature <= 1600) {
      voiceSafetyService.resolveAlert("Furnace Overheating");
      voiceSafetyService.resolveAlert("Rapid Temp Increase");
    }
  }, [meltTemperature, currentStep, isMeltingActive]);

  // Live Furnace Simulator (Step 4 - Melting)
  useEffect(() => {
    if (currentStep !== 4 || !isMeltingActive || emergencyStop) return;

    const interval = setInterval(() => {
      // Temperature increase
      setMeltTemperature(prev => {
        const target = meltSubState === "initial_melting" ? 1492 : 1580;
        if (prev < target) return prev + 15;
        return prev;
      });

      // Melt progress cycle
      setMeltProgress(prev => {
        if (meltSubState === "initial_melting") {
          if (prev >= 35) {
            setIsMeltingActive(false);
            setSpectrometerProgress(0);
            setSpectrometerStageName("SAMPLE INSERTED");
            setMeltSubState("oes_scan_1");
            return 35;
          }
          return prev + 2;
        } else if (meltSubState === "melting_2") {
          if (prev >= 75) {
            setIsMeltingActive(false);
            setSpectrometerProgress(0);
            setSpectrometerStageName("SAMPLE INSERTED");
            setMeltSubState("oes_scan_2");
            return 75;
          }
          return prev + 3;
        } else if (meltSubState === "completed") {
          clearInterval(interval);
          return 100;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentStep, isMeltingActive, meltSubState]);

  // Synchronize smelting simulation state to PostgreSQL
  const syncSmeltingRunState = async (subState: string, progress: number, temp: number) => {
    let status: 'STANDBY' | 'PREPARING' | 'CHARGING' | 'MELTING' | 'REFINING' | 'READY_TO_TAP' | 'TAPPING' | 'COMPLETED' = 'STANDBY';
    let current_stage = 'Idle';

    if (subState === "initial_melting") {
      if (progress < 10) {
        status = 'CHARGING';
        current_stage = 'Charging Materials';
      } else {
        status = 'MELTING';
        current_stage = 'Melting Started';
      }
    } else if (subState.startsWith("sampling_required") || subState.startsWith("oes_scan") || subState.startsWith("report")) {
      if (subState === "report_2") {
        status = 'READY_TO_TAP';
        current_stage = 'Quality Validation';
      } else {
        status = 'REFINING';
        current_stage = 'Composition Adjustment';
      }
    } else if (subState === "melting_2") {
      status = 'MELTING';
      current_stage = 'Melting Started';
    } else if (subState === "pouring") {
      status = 'TAPPING';
      current_stage = 'Tapping';
    } else if (subState === "completed") {
      status = 'COMPLETED';
      current_stage = 'Completed';
    }

    const power = isMeltingActive ? 2200 + Math.random() * 200 : 0;
    const energy = Math.round((progress / 100) * 850);
    const weight = Math.round((progress / 100) * batchWeight);

    try {
      await dataService.updateSmeltingRun({
        status,
        current_stage,
        temperature: temp,
        power: isMeltingActive ? power : 0,
        energy_consumption: energy,
        melt_weight: weight,
        batch_progress: progress,
        predicted_quality: 98.29
      });
    } catch (e) {
      console.error("Failed to sync smelting run state:", e);
    }
  };

  useEffect(() => {
    if (currentStep === 4) {
      syncSmeltingRunState(meltSubState, meltProgress, meltTemperature);
    }
  }, [meltSubState, meltProgress, meltTemperature, currentStep, isMeltingActive]);

  // Digital Twin Furnace Canvas drawing
  useEffect(() => {
    if (currentStep !== 4) return;
    const canvas = furnaceTwinCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let waveOffset = 0;

    const drawTwin = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2 + 10;
      const sizeFactor = Math.min(width, height) / 320;

      // Draw isometric grid background
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.02)';
      ctx.lineWidth = 0.5;
      for (let i = -150; i <= 150; i += 30) {
        ctx.beginPath();
        ctx.moveTo(cx + i, cy - 100);
        ctx.lineTo(cx + i, cy + 100);
        ctx.stroke();
      }

      // Draw outer furnace shell
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 2 * sizeFactor;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 40, 70 * sizeFactor, 40 * sizeFactor, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // Vertical shell lines
      ctx.beginPath();
      ctx.moveTo(cx - 70 * sizeFactor, cy - 40);
      ctx.lineTo(cx - 70 * sizeFactor, cy + 40);
      ctx.moveTo(cx + 70 * sizeFactor, cy - 40);
      ctx.lineTo(cx + 70 * sizeFactor, cy + 40);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(cx, cy - 40, 70 * sizeFactor, 40 * sizeFactor, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Liquid Molten metal (level increases based on batch weight size)
      const liquidHeight = Math.min(35, 10 + (batchWeight / 150)); // higher batch size -> deeper pool
      const poolY = cy + 40 - liquidHeight;

      // Wave animation
      waveOffset += 0.06;
      ctx.beginPath();
      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const wOffset = Math.sin(theta * 4 + waveOffset) * 2;
        const px = cx + (68 * sizeFactor + wOffset) * Math.cos(theta);
        const py = poolY + (36 * sizeFactor + wOffset) * Math.sin(theta);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Glowing color relative to temperature
      const tempFactor = Math.min(1, (meltTemperature - 1000) / 600); // 1000C to 1600C
      const heatColorCenter = `rgba(255, ${200 + tempFactor * 55}, ${100 + tempFactor * 100}, 0.95)`;
      const heatColorEdge = `rgba(${150 + tempFactor * 105}, 30, 0, 0.85)`;

      const meltGrad = ctx.createRadialGradient(cx, poolY, 2, cx, poolY, 68 * sizeFactor);
      meltGrad.addColorStop(0, heatColorCenter);
      meltGrad.addColorStop(0.5, '#f97316');
      meltGrad.addColorStop(1, heatColorEdge);
      ctx.fillStyle = meltGrad;
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(249, 115, 22, 0.5)';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Heating spark particle loops
      if (isMeltingActive && Math.random() < 0.3) {
        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(cx + (Math.random() - 0.5) * 50, poolY + (Math.random() - 0.5) * 10, 2, 0, Math.PI*2);
        ctx.fill();
      }

      animId = requestAnimationFrame(drawTwin);
    };

    drawTwin();
    return () => cancelAnimationFrame(animId);
  }, [currentStep, meltTemperature, isMeltingActive, batchWeight]);

  // OES 3D Laboratory Scanner Animation (Canvas Sequence: 3.5s duration)
  useEffect(() => {
    if (currentStep !== 4 || !meltSubState.startsWith("oes_scan")) return;
    const canvas = oesCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;
    const sparksCount = 12;
    const sparkParticles: {x: number, y: number, vx: number, vy: number, age: number}[] = [];

    const drawOES = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Draw Spectrometer Chamber box
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(10, 15, 26, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx - 100, cy - 80, 200, 160, 12);
      ctx.fill();
      ctx.stroke();

      // 2. Animated sliding chamber door
      // t goes from 0 to 100 during scan
      const openRatio = t < 15 ? (15 - t)/15 : t > 85 ? (t - 85)/15 : 0; // open at start/end
      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
      ctx.beginPath();
      ctx.roundRect(cx - 80, cy - 60 - openRatio * 40, 160, 50, 4);
      ctx.fill();

      // 3. Robotic sample arm loading
      const armX = t < 25 ? cx - 120 + (t/25)*120 : t > 75 ? cx - ((t-75)/25)*120 : cx;
      ctx.strokeStyle = '#00f3ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(armX - 60, cy + 20);
      ctx.lineTo(armX, cy + 20);
      ctx.stroke();
      
      // Sample disc
      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.beginPath();
      ctx.arc(armX, cy + 20, 14, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#00f3ff';
      ctx.stroke();

      // 4. Spark Emission (t between 30 and 55)
      if (t >= 30 && t <= 55) {
        setSpectrometerStageName("SPARK DISCHARGE EMISSION");
        // spawn particles
        if (Math.random() < 0.5) {
          sparkParticles.push({
            x: cx, y: cy + 20,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            age: 0
          });
        }

        // Draw sparks
        sparkParticles.forEach((sp, idx) => {
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.age++;
          ctx.strokeStyle = `rgba(0, 243, 255, ${1 - sp.age/15})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          ctx.lineTo(sp.x - sp.vx, sp.y - sp.vy);
          ctx.stroke();
        });

        // Glowing core discharge
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.beginPath();
        ctx.arc(cx, cy + 20, 8, 0, Math.PI*2);
        ctx.fill();
      }

      // 5. Laser Scan sweeping line (t between 55 and 75)
      if (t >= 55 && t <= 75) {
        setSpectrometerStageName("BLUE LASER SCANNING");
        const laserY = cy - 20 + Math.sin(t*0.5) * 30;
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.85)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        ctx.moveTo(cx - 70, laserY);
        ctx.lineTo(cx + 70, laserY);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      if (t >= 75 && t < 95) {
        setSpectrometerStageName("SPECTRUM ANALYSIS");
      }

      // Progress increment
      t += 1.5;
      setSpectrometerProgress(Math.min(100, Math.round(t)));
      
      if (t < 100) {
        animId = requestAnimationFrame(drawOES);
      } else {
        // Complete Scan, advance state to report
        setSpectrometerScansCount(prev => prev + 1);
        if (meltSubState === "oes_scan_1") {
          setMeltSubState("report_1");
        } else if (meltSubState === "oes_scan_2") {
          setMeltSubState("report_2");
        } else if (meltSubState === "oes_scan_validation") {
          setMeltSubState("ready_to_tap");
          voiceSafetyService.triggerAlert(
            "Composition Verified",
            "Composition Verified. Furnace Ready for Tapping.",
            1,
            99.8,
            "Initiate tapping sequence by clicking Pour Metal.",
            "Tapping"
          );
        }
      }
    };

    drawOES();
    return () => cancelAnimationFrame(animId);
  }, [currentStep, meltSubState]);

  // Tapping / Pouring Animation Canvas (meltSubState === 'pouring')
  useEffect(() => {
    if (currentStep !== 4 || meltSubState !== "pouring") return;
    const canvas = pouringCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const drawPouring = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Draw tilted furnace body (induction coil cylinder rotated)
      ctx.save();
      ctx.translate(cx - 60, cy);
      ctx.rotate((Math.min(45, t/3) * Math.PI) / 180);
      
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 20, 0, 0, Math.PI*2);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(-40, 0);
      ctx.lineTo(-40, 80);
      ctx.moveTo(40, 0);
      ctx.lineTo(40, 80);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.ellipse(0, 80, 40, 20, 0, 0, Math.PI*2);
      ctx.stroke();

      ctx.restore();

      // 2. Draw Molten Pour stream falling down
      if (t > 15) {
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.95)';
        ctx.lineWidth = 6;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f97316';
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy + 10);
        ctx.quadraticCurveTo(cx - 15, cy + 60, cx + 50, cy + 100);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Sparks shooting from stream
        if (Math.random() < 0.4) {
          ctx.fillStyle = '#ffedd5';
          ctx.beginPath();
          ctx.arc(cx + 10 + (Math.random() - 0.5)*20, cy + 70 + (Math.random() - 0.5)*20, 2, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // 3. Draw Ladle filling up
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cx + 20, cy + 70, 70, 50, 4);
      ctx.stroke();

      // Fill height increases
      const fillHeight = Math.min(46, (t/3));
      ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx + 22, cy + 118 - fillHeight, 66, fillHeight, 2);
      ctx.fill();

      t += 1;
      
      if (t < 150) {
        animId = requestAnimationFrame(drawPouring);
      } else {
        // Complete Tapping, move to final report
        setMeltSubState("completed");
        setCurrentStep(5); // Complete batch, show reports!
      }
    };

    drawPouring();
    return () => cancelAnimationFrame(animId);
  }, [currentStep, meltSubState]);

  const handleNext = () => {
    if (currentStep < stepsList.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const initiateScan = () => {
    setSpectrometerProgress(0);
    setSpectrometerStageName("SAMPLE INSERTED");
    if (meltSubState === "sampling_required_1") {
      setMeltSubState("oes_scan_1");
    } else if (meltSubState === "sampling_required_2") {
      setMeltSubState("oes_scan_2");
    }
  };

  // Adjust composition with AI recommended trim weights
  const applyTrimAdjustment = (material: string, weight: number) => {
    setAdditionsApplied(prev => [...prev, `${material} (${weight} kg)`]);
    
    // Simulate target element convergence
    setCurrentComposition(prev => {
      const updated = { ...prev };
      if (meltSubState === "report_1") {
        // Cr was low. Stabilize it.
        updated.Cr = selectedAlloy.composition.Cr;
        updated.Fe = roundVal(updated.Fe - 0.2); // balance
        setMeltSubState("melting_2");
        setIsMeltingActive(true);
      } else if (meltSubState === "report_2") {
        // Si/Ni was low. Stabilize.
        if (updated.Ni) updated.Ni = selectedAlloy.composition.Ni;
        if (updated.Si) updated.Si = selectedAlloy.composition.Si;
        updated.Fe = roundVal(100.0 - Object.entries(updated).filter(([k]) => k !== "Fe").reduce((acc, [_, v]) => acc + v, 0));
        
        // Automatically perform another spectrometer analysis validation check
        setSpectrometerProgress(0);
        setSpectrometerStageName("SAMPLE INSERTED");
        setMeltSubState("oes_scan_validation");
      }
      return updated;
    });
  };

  const roundVal = (val: number) => Math.round(val * 100.0) / 100.0;

  if (alloysList.length === 0 || !selectedAlloy) {
    return (
      <div className="flex-1 bg-slate-950 min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="animate-spin duration-1000 ease-in-out">
            <RefreshCw className="h-8 w-8 text-cyan-400 mx-auto" />
          </div>
          <p className="text-slate-400 text-xs font-mono">Ingesting alloys catalog from PostgreSQL database...</p>
        </div>
      </div>
    );
  }

  const activeAlerts = alertsList.filter(a => !a.acknowledged);

  return (
    <div className="min-h-screen bg-transparent text-slate-100 font-inter relative">
      <DashboardHeader />

      {/* Floating Alert Popups Overlay */}
      {currentStep === 4 && activeAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm space-y-3">
          {activeAlerts.slice(0, 3).map((alert) => (
            <Card key={alert.id} className={`border-l-4 shadow-2xl backdrop-blur-md overflow-hidden transition-all duration-300 ${
              alert.priority === 3 
                ? 'bg-red-950/95 border-red-500 text-white shadow-red-500/10' 
                : alert.priority === 2
                ? 'bg-amber-950/95 border-amber-500 text-amber-100 shadow-amber-500/10'
                : 'bg-cyan-950/95 border-cyan-500 text-cyan-100 shadow-cyan-500/10'
            }`}>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className={`h-5 w-5 ${alert.priority === 3 ? 'text-red-400 animate-pulse' : alert.priority === 2 ? 'text-amber-400' : 'text-cyan-400'}`} />
                    <span className="font-bold text-[10px] uppercase tracking-wider font-mono">
                      {alert.priority === 3 ? 'CRITICAL SAFETY FAILURE' : alert.priority === 2 ? 'SYSTEM WARNING' : 'SYSTEM INFO'}
                    </span>
                  </div>
                  <Badge variant="outline" className={`font-mono text-[9px] ${
                    alert.priority === 3 ? 'border-red-400 text-red-300' : alert.priority === 2 ? 'border-amber-400 text-amber-300' : 'border-cyan-400 text-cyan-300'
                  }`}>
                    AI Confidence: {alert.aiConfidence}%
                  </Badge>
                </div>
                
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold font-outfit uppercase tracking-wider">{alert.title}</h4>
                    <span className="text-[9px] font-mono opacity-50 uppercase tracking-widest">{alert.category || 'General'}</span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-90">{alert.message}</p>
                </div>

                <div className="p-2 bg-black/40 rounded border border-white/5 text-[10px] font-mono">
                  <div className="text-[9px] uppercase tracking-widest text-slate-400 mb-0.5">Corrective Action Required:</div>
                  <div className="opacity-95">{alert.correctiveAction}</div>
                </div>

                <div className="flex justify-between items-center pt-2 text-[9px] font-mono opacity-60">
                  <span>{alert.timestamp.toLocaleTimeString()}</span>
                  <Button 
                    size="sm" 
                    onClick={() => voiceSafetyService.acknowledgeAlert(alert.id)}
                    className="bg-white hover:bg-slate-200 text-slate-950 font-bold text-[10px] h-7 px-3"
                  >
                    Acknowledge Alert
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex">
        {/* Left Sidebar Wizard Nav */}
        <aside className="w-64 bg-slate-950/80 border-r border-slate-900 fixed left-0 top-[73px] bottom-0 z-30 flex flex-col justify-between backdrop-blur-md">
          <div className="p-4 space-y-6 flex-1 overflow-y-auto">
            <div>
              <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest font-bold font-mono">Operations Console</span>
              <h2 className="text-sm font-black font-outfit text-white uppercase tracking-wider mt-0.5">MES STEEL Autopilot</h2>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-2 px-2">smelting steps</span>
              
              {stepsList.map((step) => {
                const isCurrent = currentStep === step.id;
                const isCompleted = completedSteps.includes(step.id) || step.id < currentStep;
                return (
                  <button
                    key={step.id}
                    disabled={!isCompleted && !isCurrent}
                    onClick={() => setCurrentStep(step.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono transition-all text-left ${
                      isCurrent
                        ? "bg-cyan-950/40 text-cyan-400 border border-cyan-500/25 shadow-[0_0_12px_rgba(0,243,255,0.08)]"
                        : isCompleted
                        ? "text-emerald-400 bg-emerald-950/10 border border-emerald-500/10"
                        : "text-slate-600 border border-transparent"
                    }`}
                  >
                    <span>{step.id + 1}. {step.label}</span>
                    <span>
                      {isCompleted && "✓"}
                      {isCurrent && "●"}
                      {!isCompleted && !isCurrent && "○"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 border-t border-slate-900 bg-slate-950/40 space-y-2">
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
              <Settings2 className="h-3.5 w-3.5" />
              <span>Coil Config</span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
              <BookOpen className="h-3.5 w-3.5" />
              <span>OES Lab Standards</span>
            </div>
          </div>
        </aside>

        {/* Main Content Pane */}
        <div className="pl-64 flex-1 flex flex-col min-h-[calc(100vh-73px)]">
          {/* Top Progress chain indicator */}
          <div className="bg-slate-950/30 border-b border-slate-900/60 p-4 sticky top-[73px] z-20 backdrop-blur-md">
            <div className="flex items-center space-x-2 overflow-x-auto whitespace-nowrap text-[10px] font-mono text-slate-500 pb-1 scrollbar-none">
              {stepsList.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <span className={`${currentStep === step.id ? "text-cyan-400 font-bold" : completedSteps.includes(step.id) || step.id < currentStep ? "text-emerald-400" : ""}`}>
                    {step.short}
                  </span>
                  {idx < stepsList.length - 1 && <span className="text-slate-700">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Main workspace */}
          <div className="flex-1 p-8 space-y-6">

            {/* Voice Assistant Status & Control Bar */}
            <Card className="bg-slate-950/40 border border-slate-900/60 p-4 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-xl border ${
                    voiceSettings.enabled 
                      ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(0,243,255,0.2)] animate-pulse' 
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xs font-bold font-mono tracking-widest uppercase text-white">Voice Safety Assistant</h3>
                      <Badge variant={voiceSettings.enabled ? 'default' : 'secondary'} className="text-[8px] py-0 px-1 font-mono uppercase bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                        {voiceSettings.enabled ? 'ACTIVE RUNNING' : 'MUTED'}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 font-outfit mt-0.5">Experienced Industrial Operator verbal guide & sensors supervisor.</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => voiceSafetyService.updateSettings({ enabled: !voiceSettings.enabled })}
                    className={`text-xs h-8 border-slate-800 text-slate-300 hover:text-white font-mono ${
                      voiceSettings.enabled ? 'border-cyan-500/30 text-cyan-400 hover:text-cyan-300' : ''
                    }`}
                  >
                    {voiceSettings.enabled ? 'MUTE ASSISTANT' : 'UNMUTE ASSISTANT'}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                    className="text-xs h-8 border-slate-800 text-slate-300 hover:text-white font-mono"
                  >
                    <Settings2 className="h-4 w-4 mr-1.5" />
                    {showVoiceSettings ? 'CLOSE CONFIG' : 'ASSISTANT SETTINGS'}
                  </Button>
                </div>
              </div>

              {/* Voice configuration panel */}
              {showVoiceSettings && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 mt-4 border-t border-slate-900/60 text-xs font-mono text-slate-300">
                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Speaking Volume ({(voiceSettings.volume * 100).toFixed(0)}%)</div>
                    <input 
                      type="range" min="0" max="1" step="0.1" 
                      value={voiceSettings.volume} 
                      onChange={(e) => voiceSafetyService.updateSettings({ volume: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Speaking Rate ({voiceSettings.rate}x)</div>
                    <input 
                      type="range" min="0.5" max="2" step="0.1" 
                      value={voiceSettings.rate} 
                      onChange={(e) => voiceSafetyService.updateSettings({ rate: parseFloat(e.target.value) })}
                      className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Speaker Gender</div>
                    <select 
                      value={voiceSettings.gender} 
                      onChange={(e) => voiceSafetyService.updateSettings({ gender: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-cyan-500"
                    >
                      <option value="female">Female (Recommended)</option>
                      <option value="male">Male</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Language / Accent</div>
                    <select 
                      value={voiceSettings.accent} 
                      onChange={(e) => voiceSafetyService.updateSettings({ accent: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-cyan-500"
                    >
                      <option value="US">English (US)</option>
                      <option value="GB">English (UK)</option>
                      <option value="ES">Español (ES)</option>
                      <option value="FR">Français (FR)</option>
                      <option value="DE">Deutsch (DE)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-slate-500">Alert Repeat Interval</div>
                    <select 
                      value={voiceSettings.repeatInterval} 
                      onChange={(e) => voiceSafetyService.updateSettings({ repeatInterval: parseInt(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-900 rounded px-2.5 py-1 text-[11px] focus:outline-none focus:border-cyan-500"
                    >
                      <option value="10">Every 10 seconds</option>
                      <option value="15">Every 15 seconds</option>
                      <option value="30">Every 30 seconds</option>
                    </select>
                  </div>
                </div>
              )}
            </Card>

            {/* STEP 0: Dashboard */}
            {currentStep === 0 && (
              <div className="space-y-6 animate-fade-in-up">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black font-outfit text-white tracking-tight uppercase">Plant Cockpit Control</h2>
                    <p className="text-xs font-mono text-cyan-400">Smelting, Tapping, & Optical Spectroscopy tracking</p>
                  </div>
                  <Button 
                    onClick={() => handleNext()}
                    className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700 text-slate-950 font-black px-6 shadow-lg shadow-cyan-500/10"
                  >
                    Create New Batch Run
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>

                <ComprehensiveDashboard />
              </div>
            )}

            {/* STEP 1: Select Alloy */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in-up">
                <div className="border-b border-slate-900 pb-4">
                  <h2 className="text-xl font-bold font-outfit text-white uppercase">Choose Alloy Spec Catalog</h2>
                  <p className="text-xs font-mono text-cyan-400">Filter chemical limits standard definitions</p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-2.5 text-slate-500 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search alloys database..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-900 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Alloys grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAlloys.map((alloy, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAlloy(alloy)}
                      className={`cursor-pointer rounded-xl p-4 border transition-all flex flex-col justify-between h-[180px] ${
                        selectedAlloy.name === alloy.name
                          ? 'bg-cyan-950/15 border-cyan-500/40 shadow-[0_0_15px_rgba(0,243,255,0.08)]'
                          : 'bg-card border-slate-900 hover:border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex justify-between items-center text-[9px] font-mono">
                          <span className="text-cyan-400">{alloy.standard}</span>
                          <Badge variant="outline" className="text-[8px] text-slate-400 border-slate-800">{alloy.grade}</Badge>
                        </div>
                        <h3 className="text-sm font-bold font-outfit text-white mt-2">{alloy.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{alloy.applications}</p>
                      </div>
                      <div className="text-[9px] font-mono text-slate-500 border-t border-slate-900/60 pt-2.5 mt-2 truncate">
                        {alloy.properties}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rotating preview */}
                <div className="p-5 bg-slate-950/40 border border-slate-900 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  <div className="md:col-span-8 space-y-3">
                    <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Active Standard Specification</span>
                    <h3 className="text-lg font-bold font-outfit text-white uppercase">{selectedAlloy.name}</h3>
                    <p className="text-xs text-slate-300">{selectedAlloy.applications}</p>
                  </div>
                  <div className="md:col-span-4 h-[120px] flex items-center justify-center border-l border-slate-900/60">
                    <canvas ref={previewCanvasRef} className="w-full h-full max-w-[120px]" />
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-slate-900/60">
                  <Button onClick={handleBack} variant="outline" className="glass-button text-xs">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button onClick={() => handleNext()} className="bg-primary hover:bg-primary/90 text-slate-950 font-bold text-xs">
                    Next: Enter Batch Size
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Enter Batch Size */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fade-in-up max-w-xl mx-auto py-12">
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-xl font-bold font-outfit text-white uppercase font-black">Specify Target Melt Batch Size</h2>
                  <p className="text-xs font-mono text-cyan-400">Configure target load levels in standard metric tonnes or kilograms</p>
                </div>

                <Card className="bg-card border-slate-900 shadow-xl">
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-mono text-slate-400 uppercase">Input Weight Quantity</label>
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={batchWeight}
                          onChange={(e) => setBatchWeight(Number(e.target.value))}
                          className="flex-1 px-4 py-2.5 bg-slate-950/60 border border-slate-900 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                        />
                        <select
                          value={weightUnit}
                          onChange={(e: any) => setWeightUnit(e.target.value)}
                          className="px-4 py-2.5 bg-slate-950/60 border border-slate-900 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                        >
                          <option value="kg">Kilograms (kg)</option>
                          <option value="t">Tonnes (t)</option>
                        </select>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-1">
                        Induction Crucible size limit: 500kg to 150,000kg
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4">
                  <Button onClick={handleBack} variant="outline" className="glass-button text-xs">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button onClick={() => handleNext()} className="bg-primary hover:bg-primary/90 text-slate-950 font-bold text-xs">
                    Next: Calculate Composition
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: AI Composition Calculator */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fade-in-up">
                <div className="border-b border-slate-900 pb-4">
                  <h2 className="text-xl font-bold font-outfit text-white uppercase">AI Composition calculations</h2>
                  <p className="text-xs font-mono text-cyan-400">Target Weight: {batchWeight} {weightUnit} • {selectedAlloy.name}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Target percentages */}
                  <Card className="bg-card border-slate-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Target Composition (%)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(selectedAlloy.composition).map(([symbol, value], idx) => (
                        <div key={idx} className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-slate-300 font-bold">{symbol}</span>
                            <span className="text-cyan-400">{value}%</span>
                          </div>
                          <Progress value={value} className="h-1 bg-slate-900" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Weight additions */}
                  <Card className="bg-card border-slate-900">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Required Raw Addition weights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 font-mono text-xs">
                      {Object.entries(selectedAlloy.composition).map(([symbol, value], idx) => {
                        const totalKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
                        const additionKg = (totalKg * (value / 100)).toFixed(1);
                        return (
                          <div key={idx} className="flex justify-between border-b border-slate-900 pb-2.5 last:border-0 last:pb-0">
                            <span className="text-slate-400 uppercase">{symbol} addition:</span>
                            <span className="text-white font-bold">{additionKg} kg</span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                {/* Calculated stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-xs font-mono">
                    <div className="text-slate-500 mb-1">LIQUIDUS TEMP</div>
                    <div className="text-lg font-bold text-white">1492 °C</div>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-xs font-mono">
                    <div className="text-slate-500 mb-1">ENERGY DEMAND</div>
                    <div className="text-lg font-bold text-white">550 kWh/t</div>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-xs font-mono">
                    <div className="text-slate-500 mb-1">EST MELT DURATION</div>
                    <div className="text-lg font-bold text-white">78 min</div>
                  </div>
                </div>

                {/* Guided Material Charging Assistant */}
                <Card className="bg-slate-950/50 border border-cyan-500/20 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                  <CardHeader className="pb-2 bg-slate-950/70 border-b border-slate-900">
                    <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                      <Sparkles className="h-4 w-4 mr-2 text-cyan-400 animate-pulse" />
                      AI Guided Material Charging Assistant
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="text-xs text-slate-300 leading-relaxed font-outfit">
                      Verbal guidance checklist for batch raw material loading. Speak commands will update as you confirm additions.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Step 1: Ferrochrome */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        guidedStep === 1 
                          ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_15px_rgba(0,243,255,0.05)]' 
                          : guidedStep > 1 
                          ? 'bg-slate-900/40 border-emerald-500/20 opacity-60' 
                          : 'bg-slate-900/20 border-slate-900 opacity-40'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Step 1: Chromium Trim</span>
                          {guidedStep > 1 && <span className="text-xs text-emerald-400 font-bold">✓ Complete</span>}
                        </div>
                        <h4 className="text-sm font-bold text-white font-outfit uppercase">Load 175 kg Ferrochrome</h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-1">Status: {guidedStep === 1 ? 'Awaiting loading confirmation...' : guidedStep > 1 ? '175 kg successfully loaded' : 'Queued'}</p>
                        
                        {guidedStep === 1 && (
                          <Button 
                            size="sm"
                            onClick={() => {
                              setGuidedStep(2);
                              voiceSafetyService.speak("Ferrochrome successfully added.", 1, "added_ferrochrome");
                              setTimeout(() => {
                                voiceSafetyService.speak("Please add one hundred twenty kilograms of nickel.", 1, "recommend_nickel");
                              }, 2000);
                            }}
                            className="bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] mt-3 h-8 w-full"
                          >
                            Confirm Ferrochrome Added
                          </Button>
                        )}
                      </div>

                      {/* Step 2: Nickel */}
                      <div className={`p-4 rounded-xl border transition-all ${
                        guidedStep === 2 
                          ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_15px_rgba(0,243,255,0.05)]' 
                          : guidedStep > 2 
                          ? 'bg-slate-900/40 border-emerald-500/20 opacity-60' 
                          : 'bg-slate-900/20 border-slate-900 opacity-40'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">Step 2: Nickel Trim</span>
                          {guidedStep > 2 && <span className="text-xs text-emerald-400 font-bold">✓ Complete</span>}
                        </div>
                        <h4 className="text-sm font-bold text-white font-outfit uppercase">Load 120 kg Nickel</h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-1">Status: {guidedStep === 2 ? 'Awaiting loading confirmation...' : guidedStep > 2 ? '120 kg successfully loaded' : 'Queued'}</p>
                        
                        {guidedStep === 2 && (
                          <Button 
                            size="sm"
                            onClick={() => {
                              setGuidedStep(3);
                              voiceSafetyService.speak("Nickel successfully added.", 1, "added_nickel");
                            }}
                            className="bg-cyan-400 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] mt-3 h-8 w-full"
                          >
                            Confirm Nickel Added
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-between pt-4 border-t border-slate-900/60">
                  <Button onClick={handleBack} variant="outline" className="glass-button text-xs">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  <Button 
                    onClick={async () => {
                      try {
                        // 1. Create a ProductionBatch in PostgreSQL
                        const batchRes = await fetch('/api/batches/', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            alloy_code: selectedAlloy.grade,
                            batch_weight: batchWeight,
                            weight_unit: weightUnit,
                            operator: 'op_watas'
                          })
                        });
                        const batchData = await batchRes.json();
                        
                        // 2. Create the SmeltingRun record in PostgreSQL
                        await dataService.startSmeltingRun(selectedAlloy.grade, batchWeight, batchData.id || batchData.batch_code);
                        
                        // 3. Mark run as preparing, then transition to charging/melting
                        await dataService.updateSmeltingRun({
                          status: 'PREPARING',
                          current_stage: 'Preparing Furnace',
                          batch_progress: 0,
                          temperature: 25.0
                        });
                        
                        // 4. Update local state and proceed
                        setIsMeltingActive(true);
                        setMeltProgress(0);
                        setMeltTemperature(1200);
                        setMeltSubState("initial_melting");
                        handleNext();
                      } catch (e) {
                        console.error("Failed to start smelting run:", e);
                      }
                    }} 
                    className="bg-primary hover:bg-primary/90 text-slate-950 font-bold text-xs"
                  >
                    Confirm & Start Furnace
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Live Furnace & Spectrometer Loop (Centerpiece Cockpit) */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fade-in-up">
                
                {/* 1. Normal Melting Telemetry */}
                {(meltSubState === "initial_melting" || meltSubState === "melting_2") && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                      <div>
                        <h2 className="text-xl font-bold font-outfit text-white uppercase flex items-center">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping mr-2.5"></span>
                          Furnace F001 - Active Melting
                        </h2>
                        <p className="text-xs font-mono text-cyan-400">Live Digital Twin Feed</p>
                      </div>
                      <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse font-mono text-xs">
                        {meltSubState === "initial_melting" ? "STAGE 1: SCRAP MELT" : "STAGE 2: TEMPERATURE STABILIZATION"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      <div className="lg:col-span-8">
                        <FurnaceMonitoring />
                      </div>
                      <div className="lg:col-span-4 space-y-6 animate-fade-in-up">
                        {/* Safety & Alarms Simulation Panel */}
                        <Card className="bg-card border-slate-900 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
                          <CardHeader className="pb-3 border-b border-slate-900 bg-slate-950/40">
                            <CardTitle className="text-xs font-mono text-red-400 uppercase tracking-widest flex items-center">
                              <ShieldAlert className="h-4 w-4 mr-1.5 animate-pulse text-red-500" />
                              Safety & Alarms Simulation
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                            <div className="text-[10px] text-slate-400 font-outfit leading-relaxed">
                              Toggle simulated furnace hazards to audit real-time vocal safety alerts, priority popups, and recovery protocols.
                            </div>

                            <div className="space-y-3">
                              {/* Safety Door Toggle */}
                              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg">
                                <div>
                                  <div className="text-xs font-bold text-slate-200">Safety Access Door</div>
                                  <div className="text-[9px] font-mono text-slate-500">Chamber enclosure seal</div>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSafetyDoorOpen(!safetyDoorOpen)}
                                  className={`text-[10px] font-bold h-7 px-3 border-slate-800 transition-all ${
                                    safetyDoorOpen ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'text-slate-400'
                                  }`}
                                >
                                  {safetyDoorOpen ? 'OPEN (ALARM)' : 'CLOSED (SAFE)'}
                                </Button>
                              </div>

                              {/* Cooling Water Flow Toggle */}
                              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg">
                                <div>
                                  <div className="text-xs font-bold text-slate-200">Cooling Water Flow</div>
                                  <div className="text-[9px] font-mono text-slate-500">Induction coil heat loop</div>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setCoolingWaterFailed(!coolingWaterFailed)}
                                  className={`text-[10px] font-bold h-7 px-3 border-slate-800 transition-all ${
                                    coolingWaterFailed ? 'bg-red-500/20 text-red-400 border-red-500/40' : 'text-slate-400'
                                  }`}
                                >
                                  {coolingWaterFailed ? 'FAULT (ALARM)' : 'NORMAL (SAFE)'}
                                </Button>
                              </div>

                              {/* Power Fluctuation Toggle */}
                              <div className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg">
                                <div>
                                  <div className="text-xs font-bold text-slate-200">Coil Supply Voltage</div>
                                  <div className="text-[9px] font-mono text-slate-500">Main electrical line</div>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setPowerFluctuating(!powerFluctuating)}
                                  className={`text-[10px] font-bold h-7 px-3 border-slate-800 transition-all ${
                                    powerFluctuating ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'text-slate-400'
                                  }`}
                                >
                                  {powerFluctuating ? 'SPIKES (ALARM)' : 'STABLE (SAFE)'}
                                </Button>
                              </div>

                              {/* Emergency Stop button */}
                              <Button 
                                onClick={() => setEmergencyStop(!emergencyStop)}
                                className={`w-full py-4 text-xs font-black uppercase tracking-widest rounded-lg flex items-center justify-center space-x-2 transition-all duration-300 ${
                                  emergencyStop 
                                    ? 'bg-slate-900 border border-slate-800 text-slate-500 shadow-none' 
                                    : 'bg-red-600 hover:bg-red-700 text-slate-950 shadow-[0_0_15px_rgba(220,38,38,0.4)] animate-pulse'
                                }`}
                              >
                                <Zap className="h-4 w-4 shrink-0" />
                                <span>{emergencyStop ? 'RESET E-STOP CONTROL' : 'ACTIVATE FURNACE EMERGENCY STOP'}</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Composition Verification Required Notice */}
                {meltSubState.startsWith("sampling_required") && (
                  <Card className="bg-slate-950/80 border border-cyan-500/25 p-8 max-w-xl mx-auto text-center space-y-6 shadow-[0_0_30px_rgba(0,243,255,0.15)] my-12">
                    <div className="w-16 h-16 bg-cyan-950 border border-cyan-400 rounded-full flex items-center justify-center mx-auto text-cyan-400 shadow-[0_0_20px_rgba(0,243,255,0.3)] animate-pulse">
                      <FlaskConical className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold font-outfit text-white uppercase tracking-wider">Composition Verification Required</h2>
                      <p className="text-xs font-mono text-cyan-500">Melt reached sample check limits. Insert ladle sample to Optical Emission Spectrometer.</p>
                    </div>
                    <Button 
                      onClick={initiateScan}
                      className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700 text-slate-950 font-black px-10 py-6 rounded-lg text-sm tracking-wider"
                    >
                      TAKE MOLTEN SAMPLE
                    </Button>
                  </Card>
                )}

                {/* 3. Optical Emission Spectrometer SCAN Animation */}
                {meltSubState.startsWith("oes_scan") && (
                  <Card className="bg-card border-slate-900 p-8 max-w-2xl mx-auto text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">OES OPTICAL EMISSION SPECTROMETER</span>
                      <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono animate-pulse">
                        {spectrometerStageName}
                      </Badge>
                    </div>
                    
                    <div className="h-[220px] w-full flex items-center justify-center relative">
                      <canvas ref={oesCanvasRef} className="w-full h-full max-w-[400px]" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-1">
                        <span>SCANNING PROGRESS</span>
                        <span>{spectrometerProgress}%</span>
                      </div>
                      <Progress value={spectrometerProgress} className="h-2 bg-slate-950" />
                    </div>
                  </Card>
                )}

                {/* 4. Spectrometer Analysis Laboratory Report & AI Recommendation */}
                {meltSubState.startsWith("report") && (
                  <div className="space-y-6 animate-fade-in-up">
                    <div className="border-b border-slate-900 pb-4">
                      <h2 className="text-xl font-bold font-outfit text-white uppercase">Spectrometer Analysis Laboratory Report</h2>
                      <p className="text-xs font-mono text-cyan-400">Sample ID: BATCH-{selectedAlloy.grade}-{spectrometerScansCount} • Analysis completed</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left: Element Dev list - 7 Cols */}
                      <Card className="lg:col-span-7 bg-card border-slate-900 shadow-xl">
                        <CardContent className="p-6">
                          <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                              <tr className="text-slate-500 uppercase border-b border-slate-900 pb-2">
                                <th className="pb-2">Element</th>
                                <th className="pb-2 text-right">Target %</th>
                                <th className="pb-2 text-right">Measured %</th>
                                <th className="pb-2 text-right">Deviation</th>
                                <th className="pb-2 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(selectedAlloy.composition).map(([symbol, targetVal]) => {
                                const measuredVal = currentComposition[symbol] || 0.0;
                                const dev = roundVal(measuredVal - targetVal);
                                const isOk = absVal(dev) <= (targetVal * 0.03); // within 3% tolerance
                                const isWarning = !isOk && absVal(dev) <= (targetVal * 0.06);
                                
                                return (
                                  <tr key={symbol} className="border-b border-slate-900/60">
                                    <td className="py-2.5 font-bold text-white">{symbol}</td>
                                    <td className="py-2.5 text-right text-slate-400">{targetVal}%</td>
                                    <td className="py-2.5 text-right text-white font-bold">{measuredVal}%</td>
                                    <td className={`py-2.5 text-right font-bold ${dev > 0 ? "text-emerald-400" : dev < 0 ? "text-red-400" : "text-slate-400"}`}>
                                      {dev > 0 ? `+${dev}` : dev}
                                    </td>
                                    <td className="py-2.5 text-right">
                                      {isOk ? (
                                        <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono">PASS</Badge>
                                      ) : isWarning ? (
                                        <Badge className="bg-yellow-950/80 text-yellow-400 border border-yellow-500/20 text-[9px] font-mono">WARN</Badge>
                                      ) : (
                                        <Badge className="bg-red-950/80 text-red-400 border border-red-500/20 text-[9px] font-mono animate-pulse">FAIL</Badge>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </CardContent>
                      </Card>

                      {/* Right: AI analysis corrections card - 5 Cols */}
                      <Card className="lg:col-span-5 bg-card border-slate-900 p-6 flex flex-col justify-between min-h-[340px]">
                        <div className="space-y-4">
                          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center font-bold">
                            <Cpu className="h-4 w-4 mr-2" />
                            AI Optimization Advice
                          </span>
                          
                          {/* Conditional recommendations */}
                          {meltSubState === "report_1" ? (
                            <div className="space-y-3 font-mono text-xs">
                              <div className="text-red-400 font-bold uppercase">Chromium content low by 1.80%</div>
                              <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-300">
                                <strong>Recommendation:</strong> Add 28.0 kg Ferrochrome (FeCr 65%)
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                                <div>RECOVERY RATE: <span className="text-white">98.5%</span></div>
                                <div>AI CONFIDENCE: <span className="text-cyan-400">99.1%</span></div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 font-mono text-xs">
                              <div className="text-yellow-400 font-bold uppercase">Minor Silicon trace adjustment needed</div>
                              <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-300">
                                <strong>Recommendation:</strong> Add 3.2 kg Ferrosilicon (FeSi 75%)
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                                <div>RECOVERY RATE: <span className="text-white">99.2%</span></div>
                                <div>AI CONFIDENCE: <span className="text-cyan-400">98.4%</span></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <Button 
                          onClick={() => {
                            if (meltSubState === "report_1") {
                              applyTrimAdjustment("Ferrochrome", 28.0);
                            } else {
                              applyTrimAdjustment("Ferrosilicon", 3.2);
                            }
                          }}
                          className="bg-primary hover:bg-primary/90 text-slate-950 font-black text-xs w-full py-5 mt-4"
                        >
                          APPLY RECOMMENDATION & RESUME
                        </Button>
                      </Card>
                    </div>
                  </div>
                )}

                {/* 5. Tapping / Pouring Animation */}
                {meltSubState === "pouring" && (
                  <Card className="bg-card border-slate-900 p-8 max-w-2xl mx-auto text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Crucible Pouring Sequence</span>
                      <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-mono animate-pulse">
                        TAPPING ACTIVE
                      </Badge>
                    </div>
                    <div className="h-[220px] w-full flex items-center justify-center">
                      <canvas ref={pouringCanvasRef} className="w-full h-full max-w-[400px]" />
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Discharging completed batch {selectedAlloy.grade} melt into transport ladle...
                    </div>
                  </Card>
                )}

                {/* 6. Ready to Tap Interface */}
                {meltSubState === "ready_to_tap" && (
                  <Card className="bg-slate-950/80 border border-emerald-500/25 p-8 max-w-xl mx-auto text-center space-y-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] my-12 animate-fade-in">
                    <div className="w-16 h-16 bg-emerald-950 border border-emerald-400 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold font-outfit text-white uppercase tracking-wider">Composition Verified</h2>
                      <p className="text-sm font-mono text-emerald-400">Furnace Ready for Tapping</p>
                      <p className="text-xs text-slate-400 mt-2 font-outfit leading-relaxed">
                        Validation scan complete. Alloy chemistry is fully compliant with grade specifications. Ready to discharge molten steel.
                      </p>
                    </div>
                    <Button 
                      onClick={() => setMeltSubState("pouring")}
                      className="bg-gradient-to-r from-emerald-400 to-teal-600 hover:from-emerald-500 hover:to-teal-700 text-slate-950 font-black px-10 py-6 rounded-lg text-sm tracking-wider w-full uppercase"
                    >
                      Pour Metal
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* STEP 5: Final Production Report */}
            {currentStep === 5 && (
              <div className="space-y-8 animate-fade-in-up">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <div className="inline-flex p-3 bg-emerald-950 border border-emerald-500/30 text-emerald-400 rounded-full mb-3">
                    <Award className="h-8 w-8 animate-bounce" />
                  </div>
                  <h2 className="text-3xl font-black font-outfit tracking-tight text-white uppercase mb-2">Alloy Specification Achieved</h2>
                  <p className="text-xs font-mono text-cyan-400">Smelting successfully complete • Compliance verified</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: final composition table */}
                  <Card className="bg-card border-slate-900 shadow-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Final Measured Compositions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="text-slate-500 uppercase border-b border-slate-900 pb-2">
                            <th className="pb-2">Element</th>
                            <th className="pb-2 text-right">Target %</th>
                            <th className="pb-2 text-right">Final %</th>
                            <th className="pb-2 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedAlloy.composition).map(([symbol, targetVal]) => {
                            const finalVal = currentComposition[symbol] || 0.0;
                            return (
                              <tr key={symbol} className="border-b border-slate-900/60 py-2">
                                <td className="py-2 font-bold text-white">{symbol}</td>
                                <td className="py-2 text-right text-slate-400">{targetVal}%</td>
                                <td className="py-2 text-right text-white font-bold">{finalVal}%</td>
                                <td className="py-2 text-right text-emerald-400 font-bold">✓ COMPLIANT</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* Right: run stats log */}
                  <Card className="bg-card border-slate-900 p-6 space-y-4 text-xs font-mono">
                    <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Smelting Audit Log</h3>
                    
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Spectrometer Runs:</span>
                      <span className="text-white font-bold">{spectrometerScansCount} scans</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Total Alloy Additions:</span>
                      <span className="text-white font-bold">{additionsApplied.length} adjustings</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Energy Consumption:</span>
                      <span className="text-yellow-400 font-bold">5,540 kWh</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-2">
                      <span className="text-slate-400">Smelting Run Time:</span>
                      <span className="text-white font-bold">78 minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">AI Quality Score:</span>
                      <span className="text-emerald-400 font-bold">98.22%</span>
                    </div>

                    <div className="pt-4 border-t border-slate-900 flex space-x-2">
                      <Button 
                        onClick={() => {
                          const pdf = new jsPDF();
                          pdf.text(`Alloy Production Batch Summary - ${selectedAlloy.name}`, 20, 20);
                          pdf.text(`Yield Level: 98.4%`, 20, 30);
                          pdf.text(`Spectrometer Scans: ${spectrometerScansCount}`, 20, 40);
                          pdf.text(`Quality Compliance: PASS`, 20, 50);
                          pdf.save(`oes_batch_report_${selectedAlloy.grade}.pdf`);
                          alert("PDF exported successfully!");
                        }}
                        className="bg-primary hover:bg-primary/90 text-slate-950 font-black text-xs flex-1 py-5"
                      >
                        Download PDF Report
                      </Button>
                      <Button 
                        onClick={async () => {
                          try {
                            await dataService.updateSmeltingRun({ is_active: false, status: 'STANDBY' });
                          } catch (e) {
                            console.error(e);
                          }
                          setCurrentStep(0);
                          setMeltProgress(0);
                          setMeltSubState("initial_melting");
                          setGuidedStep(0);
                        }}
                        className="glass-button text-xs flex-1 py-5"
                      >
                        New Production Batch
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

const absVal = (v: number) => Math.abs(v);
export default Dashboard;
