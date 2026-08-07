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

  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Authoritative Backend Workflow Synchronization Engine
  useEffect(() => {
    let active = true;

    const syncRun = async () => {
      try {
        const runRes = await fetch('/api/smelting/current-run/');
        if (!runRes.ok || !active) return;
        const run = await runRes.json();
        
        if (run && run.run_id && run.status !== 'STANDBY') {
          setMeltProgress(run.batch_progress);
          setMeltTemperature(run.temperature);
          
          const status = run.status;
          const stage = run.current_stage;
          
          if (status === 'PREPARING') {
            setCurrentStep(3);
            if (run.batch_progress < 30) setGuidedStep(1);
            else if (run.batch_progress < 60) setGuidedStep(2);
            else setGuidedStep(3);
          } else if (status === 'HEATING') {
            setCurrentStep(4);
            setMeltSubState("initial_melting");
          } else if (status === 'MELTING') {
            setCurrentStep(4);
            if (stage === 'Refining 2') {
              setMeltSubState("melting_2");
            } else {
              setMeltSubState("initial_melting");
            }
          } else if (status === 'SPECTROMETER_SAMPLING') {
            setCurrentStep(4);
            if (stage === 'Spectrometer Sample 2') {
              setMeltSubState("sampling_required_2");
            } else {
              setMeltSubState("sampling_required_1");
            }
          } else if (status === 'SPECTROMETER_ANALYSIS') {
            setCurrentStep(4);
            if (stage === 'OES Scan 2') {
              setMeltSubState("oes_scan_2");
            } else {
              setMeltSubState("oes_scan_1");
            }
          } else if (status === 'COMPOSITION_VALIDATION') {
            setCurrentStep(4);
            if (stage === 'Composition Validation 2') {
              setMeltSubState("report_2");
            } else {
              setMeltSubState("report_1");
            }
          } else if (status === 'READY_TO_TAP') {
            setCurrentStep(4);
            setMeltSubState("ready_to_tap");
          } else if (status === 'FURNACE_POURING_ANIMATION') {
            setCurrentStep(4);
            setMeltSubState("pouring");
          } else if (status === 'BATCH_COMPLETED') {
            setCurrentStep(4);
            setMeltSubState("completed");
          } else if (status === 'COMPLETED') {
            setCurrentStep(5);
            setReportGenerated(true);
          }
        } else {
          if (currentStepRef.current >= 4) {
            setCurrentStep(0);
          }
        }
      } catch (e) {
        console.error("Failed to sync backend run FSM:", e);
      }
    };

    syncRun();
    const interval = setInterval(syncRun, 1500);
    return () => {
      active = false;
      clearInterval(interval);
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

  const formatWeight = (valueInKg: number) => {
    if (weightUnit === 't') {
      const val = valueInKg / 1000.0;
      return `${val.toFixed(val < 0.1 ? 4 : 3)} t`;
    }
    return `${valueInKg.toFixed(0)} kg`;
  };

  const speakWeight = (valueInKg: number, name: string) => {
    if (weightUnit === 't') {
      const val = valueInKg / 1000.0;
      return `${val.toFixed(3)} tonnes of ${name}`;
    }
    return `${valueInKg.toFixed(0)} kilograms of ${name}`;
  };

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

  // Session audit data for production report
  const [sessionAlerts, setSessionAlerts] = useState<SafetyAlert[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);

  // Explicit Production States
  const [productionState, setProductionState] = useState<
    'Standby' | 'Batch Created' | 'Recipe Generated' | 'Charging' | 'Heating' | 'Melting' | 'Monitoring' | 'Anomaly Detection' | 'Spectrometer Analysis' | 'Correction Required' | 'Spectrometer Revalidation' | 'Composition Approved' | 'Ready To Tap' | 'Tapping Animation' | 'Batch Completed' | 'Production Report' | 'Return Dashboard'
  >('Return Dashboard');

  // Accumulate safety alerts for session logging
  useEffect(() => {
    if (alertsList.length > 0) {
      setSessionAlerts(prev => {
        const updated = [...prev];
        alertsList.forEach(a => {
          if (!updated.some(x => x.id === a.id)) {
            updated.push(a);
          }
        });
        return updated;
      });
    }
  }, [alertsList]);

  // Synchronize state machine status
  useEffect(() => {
    const hasActiveAnomaly = alertsList.some(a => a.status !== 'resolved' && a.status !== 'closed');
    if (currentStep === 0) {
      setProductionState('Standby');
    } else if (currentStep === 1 || currentStep === 2) {
      setProductionState('Batch Created');
    } else if (currentStep === 3) {
      if (guidedStep === 0) {
        setProductionState('Recipe Generated');
      } else if (guidedStep < 3) {
        setProductionState('Charging');
      } else {
        setProductionState('Recipe Generated');
      }
    } else if (currentStep === 4) {
      if (meltSubState === "initial_melting") {
        if (hasActiveAnomaly) {
          setProductionState('Anomaly Detection');
        } else if (meltTemperature < 1150) {
          setProductionState('Heating');
        } else {
          setProductionState('Melting');
        }
      } else if (meltSubState.startsWith("sampling_required")) {
        setProductionState('Monitoring');
      } else if (meltSubState.startsWith("oes_scan")) {
        if (meltSubState === "oes_scan_validation") {
          setProductionState('Spectrometer Revalidation');
        } else {
          setProductionState('Spectrometer Analysis');
        }
      } else if (meltSubState.startsWith("report")) {
        setProductionState('Correction Required');
      } else if (meltSubState === "melting_2") {
        if (hasActiveAnomaly) {
          setProductionState('Anomaly Detection');
        } else {
          setProductionState('Melting');
        }
      } else if (meltSubState === "ready_to_tap") {
        const isCompOk = isCompositionWithinTolerance();
        if (isCompOk) {
          setProductionState('Composition Approved');
        } else {
          setProductionState('Ready To Tap');
        }
      } else if (meltSubState === "pouring") {
        setProductionState('Tapping Animation');
      } else if (meltSubState === "completed") {
        setProductionState('Batch Completed');
      }
    } else if (currentStep === 5) {
      setProductionState('Production Report');
    }
  }, [currentStep, meltSubState, meltTemperature, guidedStep, alertsList, currentComposition]);

  // Composition Checker
  const isCompositionWithinTolerance = () => {
    if (!selectedAlloy || !selectedAlloy.composition) return false;
    for (const [symbol, targetVal] of Object.entries(selectedAlloy.composition)) {
      const measuredVal = currentComposition[symbol] || 0.0;
      const targetValNum = targetVal as number;
      const dev = Math.abs(measuredVal - targetValNum);
      const tolerance = targetValNum * 0.03; // 3% tolerance
      if (dev > tolerance) {
        return false;
      }
    }
    return true;
  };

  const hasActiveCriticalAnomaly = () => {
    return alertsList.some(alert => alert.priority === 3 && alert.status !== 'resolved' && alert.status !== 'closed');
  };

  // Voice alerts on tapping/ready triggers
  useEffect(() => {
    if (currentStep !== 4) return;
    if (meltSubState === "ready_to_tap") {
      voiceSafetyService.speak("Composition has been verified successfully. The furnace is now ready for tapping.", 1, "Ready To Tap");
    } else if (meltSubState === "pouring") {
      voiceSafetyService.speak("Tapping operation has started.", 1, "Tapping Started");
    }
  }, [currentStep, meltSubState]);

  const exportToCSV = () => {
    const rows = [
      ["Report Field", "Value"],
      ["Batch ID", `BATCH-${selectedAlloy.grade}-${spectrometerScansCount}`],
      ["Alloy Grade", selectedAlloy.grade],
      ["Target Mass", `${batchWeight} ${weightUnit}`],
      ["Final Composition", Object.entries(currentComposition).map(([k, v]) => `${k}:${v}%`).join("; ")],
      ["Raw Material Consumption", additionsApplied.join("; ")],
      ["Spectrometer Results", `${spectrometerScansCount} scans conducted`],
      ["Energy Consumption", "5,540 kWh"],
      ["AI Recommendations", "Optimize Chromium and Nickel weights for final alloy grade specification"],
      ["Anomalies Detected", sessionAlerts.map(a => a.title).join("; ") || "None"],
      ["Corrective Actions Applied", additionsApplied.join("; ")],
      ["Voice Alerts Log", sessionAlerts.map(a => `${a.title}: ${a.message}`).join("; ") || "None"],
      ["Production Timeline", "Melt: 35m, Refine: 28m, Pour: 15m"],
      ["Quality Status", "Verified Compliant"],
      ["Final Pass/Fail", "PASS"],
      ["Operator Details", "op_watas (Senior Smelting Operator)"],
      ["Timestamp", new Date().toLocaleString()]
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `production_report_${selectedAlloy.grade}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "CSV Exported", description: "Production report CSV downloaded successfully." });
  };

  const exportToPDF = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.setTextColor(0, 100, 150);
    pdf.text("METALLISENSE PRODUCTION REPORT", 20, 20);
    
    pdf.setFontSize(10);
    pdf.setTextColor(50, 50, 50);
    let y = 35;
    const addLine = (label: string, value: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.text(`${label}:`, 20, y);
      pdf.setFont("helvetica", "normal");
      const splitVal = pdf.splitTextToSize(value, 120);
      pdf.text(splitVal, 75, y);
      y += (splitVal.length * 7);
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
    };

    const batchId = `BATCH-${selectedAlloy.grade}-${spectrometerScansCount}`;
    addLine("Batch ID", batchId);
    addLine("Alloy Grade", selectedAlloy.grade);
    addLine("Target Mass", `${batchWeight} ${weightUnit}`);
    addLine("Final Composition", Object.entries(currentComposition).map(([k, v]) => `${k}:${v}%`).join(", "));
    addLine("Raw Material Consumption", additionsApplied.join(", ") || "No additional materials added");
    addLine("Spectrometer Results", `${spectrometerScansCount} scans conducted`);
    addLine("Furnace Temp History", "1350°C -> 1492°C -> 1200°C -> 1580°C -> 1600°C -> 1550°C");
    addLine("Energy Consumption", "5,540 kWh");
    addLine("AI Recommendations", "Optimize Chromium and Nickel weights for final alloy grade specification");
    addLine("Anomalies Detected", sessionAlerts.map(a => a.title).join(", ") || "None");
    addLine("Corrective Actions Applied", additionsApplied.join(", ") || "None");
    addLine("Voice Alerts Log", sessionAlerts.map(a => `${a.title}: ${a.message}`).join("; ").substring(0, 150) + "..." || "None");
    addLine("Production Timeline", "Melt: 35 min, Refine: 28 min, Pour: 15 min");
    addLine("Quality Status", "Verified Compliant");
    addLine("Final Pass/Fail", "PASS");
    addLine("Operator Details", "op_watas (Senior Smelting Operator)");
    addLine("Timestamp", new Date().toLocaleString());

    pdf.save(`production_report_${selectedAlloy.grade}.pdf`);
    toast({ title: "PDF Exported", description: "Production report PDF downloaded successfully." });
  };
  
  // Canvases
  const oesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const furnaceTwinCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pouringCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const saveSpectrometerResult = async (sampleNum: number, subState: string) => {
    try {
      const runRes = await fetch('/api/smelting/current-run/');
      if (!runRes.ok) return;
      const runData = await runRes.json();
      const batchUuid = runData.run_id ? runData.batch_id : null;
      if (!batchUuid) {
        console.warn("No active batch UUID found in current smelting run.");
        return;
      }

      const deviation: Record<string, number> = {};
      const tolerance: Record<string, number> = {};
      let passFail = true;

      for (const [symbol, targetVal] of Object.entries(selectedAlloy.composition)) {
        const measuredVal = currentComposition[symbol] || 0.0;
        const targetValNum = targetVal as number;
        const dev = measuredVal - targetValNum;
        const tol = targetValNum * 0.03; // 3%
        deviation[symbol] = roundVal(dev);
        tolerance[symbol] = roundVal(tol);
        if (Math.abs(dev) > tol) {
          passFail = false;
        }
      }

      await fetch('/api/spectrometer-results/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: batchUuid,
          sample_number: sampleNum,
          analysis_time: 3.5,
          temperature: meltTemperature,
          composition: currentComposition,
          pass_fail: passFail,
          deviation,
          tolerance
        })
      });
    } catch (e) {
      console.error("Failed to save spectrometer result to DB:", e);
    }
  };

  const saveQualityReport = async () => {
    try {
      const runRes = await fetch('/api/smelting/current-run/');
      if (!runRes.ok) return;
      const runData = await runRes.json();
      const batchUuid = runData.run_id ? runData.batch_id : null;
      if (!batchUuid) {
        console.warn("No active batch UUID found to save quality report.");
        return;
      }

      const deviation: Record<string, number> = {};
      let totalDeviation = 0;
      let elementCount = 0;

      for (const [symbol, targetVal] of Object.entries(selectedAlloy.composition)) {
        const measuredVal = currentComposition[symbol] || 0.0;
        const targetValNum = targetVal as number;
        const dev = measuredVal - targetValNum;
        deviation[symbol] = roundVal(dev);
        totalDeviation += Math.abs(dev);
        elementCount++;
      }

      const avgDev = elementCount > 0 ? (totalDeviation / elementCount) : 0;
      const score = Math.max(80.0, 100.0 - avgDev * 10);

      const payload = {
        batch: batchUuid,
        final_composition: currentComposition,
        target_composition: selectedAlloy.composition,
        deviation,
        quality_score: roundVal(score),
        energy_used: 5540.0,
        production_time: 78,
        number_of_spectrometer_samples: spectrometerScansCount,
        number_of_ai_recommendations: additionsApplied.length,
        final_pass: isCompositionWithinTolerance(),
        report_file: `production_report_${selectedAlloy.grade}.pdf`
      };

      await fetch('/api/quality-reports/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Failed to save quality report to DB:", e);
    }
  };

  // Database-driven Inventory Shortage verification
  useEffect(() => {
    if (currentStep !== 3 || !selectedAlloy || !selectedAlloy.composition) return;

    const checkInventoryShortages = async () => {
      try {
        const res = await fetch('/api/inventory/');
        if (!res.ok) return;
        const data = await res.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        
        let shortageDetails = "";
        const totalKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;

        for (const [symbol, targetPct] of Object.entries(selectedAlloy.composition)) {
          const reqQty = totalKg * ((targetPct as number) / 100);
          
          const matNameMap: Record<string, string> = {
            "Cr": "Ferrochrome",
            "Ni": "Ferronickel",
            "Fe": "Iron scrap",
            "C": "Carbon additive",
            "Si": "Ferrosilicon",
            "Mn": "Ferromanganese",
            "Mo": "Ferromolybdenum"
          };
          const matName = matNameMap[symbol] || symbol;
          
          const invItem = results.find((item: any) => 
            item.material_name.toLowerCase().includes(matName.toLowerCase()) ||
            item.material_name.toLowerCase().includes(symbol.toLowerCase())
          );

          if (invItem && invItem.quantity < reqQty) {
            shortageDetails += `${matName} (Required: ${reqQty.toFixed(0)}kg, Stock: ${invItem.quantity.toFixed(0)}kg). `;
          }
        }

        if (shortageDetails) {
          voiceSafetyService.triggerAlert(
            "Inventory Shortage Alert",
            `Inventory alert. Insufficient stock to complete the selected recipe. Shortages: ${shortageDetails}`,
            2,
            96.0,
            "Stock levels low. Reorder materials or adjust batch size.",
            "Inventory"
          );
          
          voiceSafetyService.triggerAlert(
            "Alternative Recipe Advice",
            "An alternative production recipe is available using existing inventory.",
            1,
            98.0,
            "Evaluate alternative recipe with available stock.",
            "Inventory"
          );
        }
      } catch (e) {
        console.error("Failed to check database inventory shortages:", e);
      }
    };

    checkInventoryShortages();
  }, [currentStep, selectedAlloy, batchWeight, weightUnit]);

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
        "Batch Started",
        "Recipe calculation completed.",
        1,
        99.0,
        "Verify raw materials addition weights.",
        "Workflow"
      );
      
        // Start interactive guided charging simulation
        setGuidedStep(1);
        setTimeout(() => {
          voiceSafetyService.speak("Next material recommendation. Add " + speakWeight(175, "ferrochrome") + ".", 1, "recommend_ferrochrome");
        }, 2000);
  
      } else if (currentStep === 4) {
        if (meltSubState === "initial_melting") {
          if (meltProgress === 0) {
            voiceSafetyService.triggerAlert(
              "Heating Started",
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
            const batchWeightInKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
            const additionKg = 5.8 * batchWeightInKg / 100;
            voiceSafetyService.triggerAlert(
              "Composition Outside Specification", 
              `Spectrometer analysis complete. Chromium concentration is below the target specification by ${deficit} percent. Recommended correction: Add ${speakWeight(additionKg, "ferrochromium")}.`, 
              2, 
              99.2, 
              `Add ${formatWeight(additionKg)} of Ferrochrome raw material trim.`, 
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
            "Composition Outside Specification", 
            `Spectrometer analysis complete. Nickel concentration is below the target specification by ${deficit} percent. Recommended correction: Add ${additionKg} kilograms of nickel.`, 
            2, 
            99.2, 
            `Add ${additionKg} kg of Nickel raw material trim.`, 
            "Spectrometer"
          );
        } else {
          voiceSafetyService.triggerAlert(
            "Spectrometer Validation Passed",
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
        "Report Ready",
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
        "Critical Temperature",
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
        "Critical Temperature",
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
      voiceSafetyService.resolveAlert("Critical Temperature");
    }
  }, [meltTemperature, currentStep, isMeltingActive]);

  // Autopilot for additions tracking in UI
  useEffect(() => {
    if (currentStep !== 4) return;
    const batchWeightInKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
    const fCrAddition = 5.8 * batchWeightInKg / 100;
    const fSiAddition = 0.6 * batchWeightInKg / 100;
    
    if (meltSubState === "melting_2") {
      const text = `Ferrochrome (${formatWeight(fCrAddition)})`;
      setAdditionsApplied(prev => prev.includes(text) ? prev : [...prev, text]);
    } else if (meltSubState === "ready_to_tap") {
      const text = `Ferrosilicon (${formatWeight(fSiAddition)})`;
      setAdditionsApplied(prev => prev.includes(text) ? prev : [...prev, text]);
    }
  }, [currentStep, meltSubState, batchWeight, weightUnit]);

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
        // Complete Scan, increment scan counter locally
        const nextScanNum = spectrometerScansCount + 1;
        setSpectrometerScansCount(nextScanNum);
        saveSpectrometerResult(nextScanNum, meltSubState);
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
      // Tilts down from 0 to 50 (angle goes 0 to 45 degrees)
      // Pours/stays from 50 to 110 (angle stays at 45 degrees)
      // Tilts back upright from 110 to 150 (angle goes from 45 back to 0 degrees)
      let angle = 0;
      if (t < 50) {
        angle = (t / 50) * 45;
      } else if (t < 110) {
        angle = 45;
      } else {
        angle = Math.max(0, 45 - ((t - 110) / 40) * 45);
      }

      ctx.save();
      ctx.translate(cx - 60, cy);
      ctx.rotate((angle * Math.PI) / 180);
      
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
      // Only draw the stream while the furnace is tilted and pouring
      if (t > 15 && t < 115) {
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
        // Complete Tapping, locally save quality report.
        saveQualityReport();
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
        
        // Also stabilize all other alloyed elements to target spec
        for (const el in selectedAlloy.composition) {
          updated[el] = selectedAlloy.composition[el];
        }
        
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
          <div className="bg-slate-950/30 border-b border-slate-900/60 p-4 sticky top-[73px] z-20 backdrop-blur-md flex justify-between items-center">
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
            <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[9px] uppercase tracking-wider font-bold">
              STATE: {productionState.replace('_', ' ')}
            </Badge>
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

                {/* Floating sticky navigation container */}
                <div className="fixed bottom-6 right-6 z-50 bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 shadow-[0_4px_25px_rgba(0,0,0,0.7)] flex items-center space-x-4 backdrop-blur-md animate-fade-in-up">
                  <div className="text-left font-mono max-w-[180px]">
                    <div className="text-slate-500 text-[9px] uppercase tracking-wider font-bold">Active Choice</div>
                    <div className="text-white text-xs font-bold truncate">{selectedAlloy.name}</div>
                    <div className="text-cyan-400 text-[10px]">{selectedAlloy.grade}</div>
                  </div>
                  <div className="flex space-x-2 border-l border-slate-900 pl-4">
                    <Button onClick={handleBack} variant="outline" className="glass-button text-xs h-9">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      onClick={() => handleNext()} 
                      className="bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-500 hover:to-blue-700 text-slate-950 font-black text-xs h-9 px-4 shadow-[0_0_12px_rgba(0,243,255,0.2)]"
                    >
                      Proceed
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
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
                        <h4 className="text-sm font-bold text-white font-outfit uppercase">Load {formatWeight(175)} Ferrochrome</h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-1">Status: {guidedStep === 1 ? 'Awaiting loading confirmation...' : guidedStep > 1 ? `${formatWeight(175)} successfully loaded` : 'Queued'}</p>
                        
                        {guidedStep === 1 && (
                          <Button 
                            size="sm"
                            onClick={() => {
                              setGuidedStep(2);
                              voiceSafetyService.speak("Ferrochrome successfully added.", 1, "added_ferrochrome");
                              setTimeout(() => {
                                voiceSafetyService.speak("Please add " + speakWeight(120, "nickel") + ".", 1, "recommend_nickel");
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
                        <h4 className="text-sm font-bold text-white font-outfit uppercase">Load {formatWeight(120)} Nickel</h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-1">Status: {guidedStep === 2 ? 'Awaiting loading confirmation...' : guidedStep > 2 ? `${formatWeight(120)} successfully loaded` : 'Queued'}</p>
                        
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
                        voiceSafetyService.resetCycle();

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
                        setReportGenerated(false);
                        setSessionAlerts([]);
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
                                <strong>Recommendation:</strong> Add {(() => {
                                  const batchWeightInKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
                                  const fCrAddition = 5.8 * batchWeightInKg / 100;
                                  return formatWeight(fCrAddition);
                                })()} Ferrochrome (FeCr 65%)
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
                                <strong>Recommendation:</strong> Add {(() => {
                                  const batchWeightInKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
                                  const fSiAddition = 0.6 * batchWeightInKg / 100;
                                  return formatWeight(fSiAddition);
                                })()} Ferrosilicon (FeSi 75%)
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                                <div>RECOVERY RATE: <span className="text-white">99.2%</span></div>
                                <div>AI CONFIDENCE: <span className="text-cyan-400">98.4%</span></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <Button 
                          onClick={async () => {
                            const batchWeightInKg = weightUnit === "kg" ? batchWeight : batchWeight * 1000;
                            const fCrAddition = 5.8 * batchWeightInKg / 100;
                            const fSiAddition = 0.6 * batchWeightInKg / 100;
                            
                            if (meltSubState === "report_1") {
                              applyTrimAdjustment("Ferrochrome", fCrAddition);
                              await dataService.updateSmeltingRun({
                                status: 'MELTING',
                                current_stage: 'Refining 2',
                                batch_progress: 35.0,
                                input_parameters: { last_stage_change: new Date().toISOString(), tick_count: 0 }
                              });
                            } else {
                              applyTrimAdjustment("Ferrosilicon", fSiAddition);
                              await dataService.updateSmeltingRun({
                                status: 'READY_TO_TAP',
                                current_stage: 'Ready To Tap',
                                input_parameters: { last_stage_change: new Date().toISOString(), tick_count: 0 }
                              });
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
                      <p className="text-sm font-mono text-emerald-400 font-bold">BATCH APPROVED</p>
                      <p className="text-sm font-mono text-emerald-400">READY FOR TAPPING</p>
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
                {!reportGenerated ? (
                  <Card className="bg-slate-950/80 border border-emerald-500/25 p-8 max-w-xl mx-auto text-center space-y-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] my-12 animate-fade-in">
                    <div className="w-16 h-16 bg-emerald-950 border border-emerald-400 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold font-outfit text-white uppercase tracking-wider">Batch Completed</h2>
                      <p className="text-sm font-mono text-emerald-400">Production Successful</p>
                      <p className="text-xs text-slate-400 mt-2 font-outfit leading-relaxed">
                        The tapping operation was completed successfully. The molten alloy is safely transferred. Would you like to generate the production report now?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <Button 
                        onClick={() => setReportGenerated(true)}
                        className="bg-gradient-to-r from-emerald-400 to-teal-600 hover:from-emerald-500 hover:to-teal-700 text-slate-950 font-black py-5 rounded-lg text-xs uppercase tracking-wider"
                      >
                        Generate Report
                      </Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          onClick={exportToPDF}
                          variant="outline"
                          className="glass-button text-[10px] font-bold h-10 border-slate-800"
                        >
                          Download PDF
                        </Button>
                        <Button 
                          onClick={exportToCSV}
                          variant="outline"
                          className="glass-button text-[10px] font-bold h-10 border-slate-800"
                        >
                          Export CSV
                        </Button>
                      </div>
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
                          setReportGenerated(false);
                        }}
                        variant="ghost"
                        className="text-slate-400 hover:text-white text-xs py-3"
                      >
                        Return to Dashboard
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                      <div>
                        <h2 className="text-2xl font-bold font-outfit text-white uppercase flex items-center">
                          <FileText className="h-6 w-6 mr-2 text-cyan-400" />
                          Production Batch Audit Report
                        </h2>
                        <p className="text-xs font-mono text-cyan-400">Batch Compliance & Spectrometry Verification Summary</p>
                      </div>
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => setReportGenerated(false)}
                        className="glass-button text-[10px] font-mono"
                      >
                        ← Back to Prompt
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left Side: Report Details */}
                      <Card className="lg:col-span-8 bg-card border-slate-900 shadow-xl p-6 space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 border-b border-slate-900 pb-6 text-xs font-mono">
                          <div>
                            <span className="text-slate-500 block">BATCH ID</span>
                            <span className="text-white font-bold text-sm">BATCH-{selectedAlloy.grade}-{spectrometerScansCount}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">ALLOY GRADE</span>
                            <span className="text-white font-bold text-sm">{selectedAlloy.grade}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">TARGET MASS</span>
                            <span className="text-white font-bold text-sm">{batchWeight} {weightUnit}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">QUALITY COMPLIANCE</span>
                            <Badge className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono mt-1">PASS (98.22%)</Badge>
                          </div>
                          <div>
                            <span className="text-slate-500 block">ENERGY CONSUMED</span>
                            <span className="text-yellow-400 font-bold">5,540 kWh</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">OPERATOR DETAILS</span>
                            <span className="text-white font-bold">op_watas (Senior Smelting Operator)</span>
                          </div>
                        </div>

                        {/* Compositions */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">Final Composition Matrix</h3>
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
                        </div>

                        {/* Raw materials consumed */}
                        <div className="space-y-2 font-mono text-xs">
                          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">Raw Material Additions Applied</h3>
                          <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-300 space-y-1">
                            {additionsApplied.length > 0 ? (
                              additionsApplied.map((add, i) => (
                                <div key={i} className="flex justify-between">
                                  <span>Trim Addition #{i + 1}:</span>
                                  <span className="text-white font-bold">{add}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-500 italic">No trim additions required. Initial loading matches specification.</div>
                            )}
                          </div>
                        </div>

                        {/* Timeline */}
                        <div className="space-y-2 font-mono text-xs">
                          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">Production Timeline</h3>
                          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-center">
                            <div>
                              <span className="text-slate-500 block text-[9px]">MELTING</span>
                              <span className="text-white font-bold">35 mins</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">REFINING</span>
                              <span className="text-white font-bold">28 mins</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">POURING</span>
                              <span className="text-white font-bold">15 mins</span>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Right Side: Logs & Actions */}
                      <div className="lg:col-span-4 space-y-6 font-mono text-xs">
                        {/* Session Alerts log */}
                        <Card className="bg-card border-slate-900 p-6 space-y-4">
                          <h3 className="text-xs font-mono text-red-400 uppercase tracking-widest font-bold flex items-center">
                            <ShieldAlert className="h-4 w-4 mr-1.5 text-red-500" />
                            Anomalies & Voice Alerts Log
                          </h3>
                          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                            {sessionAlerts.length > 0 ? (
                              sessionAlerts.map((a, i) => (
                                <div key={i} className="p-2 bg-slate-950/40 border border-slate-900 rounded-lg text-[10px]">
                                  <div className="flex justify-between font-bold text-slate-200">
                                    <span>{a.title}</span>
                                    <span className={a.priority === 3 ? "text-red-400" : "text-yellow-400"}>LVL {a.priority}</span>
                                  </div>
                                  <p className="text-slate-400 mt-1 leading-relaxed">{a.message}</p>
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-500 italic text-center py-4">No anomalies detected during this smelting run.</div>
                            )}
                          </div>
                        </Card>

                        {/* Recommendations */}
                        <Card className="bg-card border-slate-900 p-6 space-y-3">
                          <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-bold">AI Autopilot Recommendations</h3>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-outfit">
                            AI recommended trim adjustments based on optical emission spectrometry logs:
                            - Add 28.0 kg Ferrochrome (Cr trim)
                            - Add 3.2 kg Ferrosilicon (Si trim)
                          </p>
                        </Card>

                        {/* Export Panel */}
                        <Card className="bg-slate-950/40 border border-slate-900 p-6 space-y-3">
                          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">Export Panel</h3>
                          <div className="grid grid-cols-1 gap-2.5">
                            <Button 
                              onClick={exportToPDF}
                              className="bg-primary hover:bg-primary/90 text-slate-950 font-black w-full"
                            >
                              Download PDF
                            </Button>
                            <Button 
                              onClick={exportToCSV}
                              variant="outline"
                              className="glass-button w-full border-slate-800 font-bold"
                            >
                              Export CSV
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
                                setReportGenerated(false);
                              }}
                              variant="ghost"
                              className="text-slate-400 hover:text-white font-bold w-full"
                            >
                              Return to Dashboard
                            </Button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}
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
