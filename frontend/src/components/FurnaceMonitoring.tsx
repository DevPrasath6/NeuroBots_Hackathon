import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Flame, Thermometer, Zap, Wind, Gauge, 
  RotateCcw, Maximize2, ZoomIn, ZoomOut, Sparkles, BrainCircuit
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { dataService } from '@/services/dataService';

interface FurnaceZone {
  id: string;
  name: string;
  temperature: number;
  targetTemp: number;
  tolerance: number;
  status: 'optimal' | 'warning' | 'critical';
}

interface PowerMetrics {
  current: number;
  average: number;
  peak: number;
  efficiency: number;
}

interface GasFlow {
  oxygen: number;
  argon: number;
  nitrogen: number;
  totalFlow: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Smoke {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  alpha: number;
}

export const FurnaceMonitoring = () => {
  const [activeBatch, setActiveBatch] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [furnaceZones, setFurnaceZones] = useState<FurnaceZone[]>([
    { id: '1', name: 'Arc Zone', temperature: 25, targetTemp: 1650, tolerance: 25, status: 'optimal' },
    { id: '2', name: 'Ladle Zone', temperature: 25, targetTemp: 1590, tolerance: 20, status: 'optimal' },
    { id: '3', name: 'Tapping Zone', temperature: 25, targetTemp: 1615, tolerance: 15, status: 'optimal' },
    { id: '4', name: 'Slag Zone', temperature: 25, targetTemp: 1500, tolerance: 30, status: 'optimal' }
  ]);

  const [powerMetrics, setPowerMetrics] = useState<PowerMetrics>({
    current: 0.0,
    average: 0.0,
    peak: 0.0,
    efficiency: 0.0
  });

  const [gasFlow, setGasFlow] = useState<GasFlow>({
    oxygen: 0.0,
    argon: 0.0,
    nitrogen: 0.0,
    totalFlow: 0.0
  });

  const [temperatureHistory] = useState([
    { time: '10:00', arcZone: 1645, ladleZone: 1575, tappingZone: 1610, slagZone: 1485 },
    { time: '10:05', arcZone: 1648, ladleZone: 1578, tappingZone: 1615, slagZone: 1480 },
    { time: '10:10', arcZone: 1650, ladleZone: 1580, tappingZone: 1620, slagZone: 1478 },
    { time: '10:15', arcZone: 1652, ladleZone: 1582, tappingZone: 1618, slagZone: 1485 },
    { time: '10:20', arcZone: 1650, ladleZone: 1580, tappingZone: 1620, slagZone: 1480 }
  ]);

  const [powerHistory] = useState([
    { time: '10:00', power: 42.5, efficiency: 85.2 },
    { time: '10:05', power: 44.1, efficiency: 86.8 },
    { time: '10:10', power: 45.8, efficiency: 87.4 },
    { time: '10:15', power: 47.2, efficiency: 88.1 },
    { time: '10:20', power: 45.8, efficiency: 87.4 }
  ]);

  const [lastUpdated, setLastUpdated] = useState(new Date());

  // 3D Twin state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [angleX, setAngleX] = useState(-0.5);
  const [angleY, setAngleY] = useState(0.6);
  const [zoom, setZoom] = useState(1.4);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Floating Holographic Composition state (simulating live updates)
  const [composition, setComposition] = useState({
    Fe: 72.14,
    Cr: 18.05,
    Ni: 8.02,
    Mn: 1.01,
    Si: 0.78
  });

  const [aiMessage, setAiMessage] = useState("Standing by. Launch new smelting run to start furnace power supply.");

  const [currentRun, setCurrentRun] = useState<any>(null);

  // Check for active smelting runs in PostgreSQL on mount & poll
  useEffect(() => {
    setIsLoading(true);
    
    const pollStatus = async () => {
      try {
        const run = await dataService.getCurrentSmeltingRun();
        setCurrentRun(run);
        
        if (run && run.status !== 'STANDBY') {
          setActiveBatch({
            id: run.batch_id || 'active',
            batch_code: run.batch_id || 'B-ACTIVE',
            alloy_name: run.selected_alloy || 'Selected Alloy',
            current_stage: run.current_stage || 'ACTIVE MELTING',
            status: run.status
          });

          // Set zones temperatures proportionally based on run.temperature
          setFurnaceZones([
            { id: '1', name: 'Arc Zone', temperature: run.temperature, targetTemp: 1650, tolerance: 25, status: run.temperature > 1500 ? 'optimal' : 'warning' },
            { id: '2', name: 'Ladle Zone', temperature: Math.max(25, run.temperature - 50), targetTemp: 1590, tolerance: 20, status: 'optimal' },
            { id: '3', name: 'Tapping Zone', temperature: Math.max(25, run.temperature - 30), targetTemp: 1615, tolerance: 15, status: 'optimal' },
            { id: '4', name: 'Slag Zone', temperature: Math.max(25, run.temperature - 100), targetTemp: 1500, tolerance: 30, status: 'warning' }
          ]);

          // Set power metrics (converting kW to MW in the display)
          setPowerMetrics({
            current: run.power > 0 ? parseFloat((run.power / 1000.0).toFixed(1)) : 0.0,
            average: 4.3,
            peak: 5.2,
            efficiency: run.power > 0 ? 87.4 : 0.0
          });

          // Set gas flow details
          setGasFlow({
            oxygen: run.power > 0 ? 125.6 : 0.0,
            argon: run.power > 0 ? 45.2 : 0.0,
            nitrogen: run.power > 0 ? 18.9 : 0.0,
            totalFlow: run.power > 0 ? 189.7 : 0.0
          });

          // Set composition if provided
          if (run.ai_recommendation && run.ai_recommendation.current_composition) {
            setComposition(run.ai_recommendation.current_composition);
          }

          // Set aiMessage based on status
          if (run.status === 'PREPARING') {
            setAiMessage("Furnace pre-heating initiated. Checking crucible lining.");
          } else if (run.status === 'CHARGING') {
            setAiMessage("Crucible charging started. Base scrap iron injected.");
          } else if (run.status === 'MELTING') {
            setAiMessage(`Thermal supply stable. Ingesting scrap at ${run.power.toFixed(0)} kW.`);
          } else if (run.status === 'REFINING') {
            setAiMessage("Argon gas stirring active. Analyzing chemical drift.");
          } else if (run.status === 'READY_TO_TAP') {
            setAiMessage("Steel composition within ASTM range. Tapping prep in progress.");
          } else if (run.status === 'TAPPING') {
            setAiMessage("Ladle pour initiated. Transporting molten metal.");
          } else if (run.status === 'COMPLETED') {
            setAiMessage("Batch completed. Return to Standby when tapping finishes.");
          }
        } else {
          setActiveBatch(null);
          setAiMessage("Standing by. Launch new smelting run to start furnace power supply.");
        }
        setIsLoading(false);
      } catch (err) {
        console.error("Error checking active run:", err);
        setIsLoading(false);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500); // poll every 1.5 seconds
    return () => clearInterval(interval);
  }, []);

  // Telemetry drift simulator
  useEffect(() => {
    if (!activeBatch) return;

    const interval = setInterval(() => {
      // Update furnace zones
      setFurnaceZones(prev => prev.map(zone => {
        const tempVariation = (Math.random() - 0.5) * 8;
        const newTemp = zone.temperature + tempVariation;
        const deviation = Math.abs(newTemp - zone.targetTemp);
        
        let status: 'optimal' | 'warning' | 'critical' = 'optimal';
        if (deviation > zone.tolerance) status = 'critical';
        else if (deviation > zone.tolerance * 0.7) status = 'warning';

        return { ...zone, temperature: newTemp, status };
      }));

      // Update power metrics
      setPowerMetrics(prev => ({
        ...prev,
        current: Math.max(30, prev.current + (Math.random() - 0.5) * 3),
        efficiency: Math.max(80, Math.min(95, prev.efficiency + (Math.random() - 0.5) * 0.8))
      }));

      // Update gas flow
      setGasFlow(prev => {
        const ox = prev.oxygen + (Math.random() - 0.5) * 4;
        const ar = prev.argon + (Math.random() - 0.5) * 1.5;
        const ni = prev.nitrogen + (Math.random() - 0.5) * 0.8;
        return {
          oxygen: ox,
          argon: ar,
          nitrogen: ni,
          totalFlow: ox + ar + ni
        };
      });

      // Drifting composition tags
      setComposition(prev => ({
        Fe: Number((prev.Fe + (Math.random() - 0.5) * 0.04).toFixed(2)),
        Cr: Number((prev.Cr + (Math.random() - 0.5) * 0.02).toFixed(2)),
        Ni: Number((prev.Ni + (Math.random() - 0.5) * 0.02).toFixed(2)),
        Mn: Number((prev.Mn + (Math.random() - 0.5) * 0.01).toFixed(2)),
        Si: Number((prev.Si + (Math.random() - 0.5) * 0.01).toFixed(2)),
      }));

      // Random AI messages
      const messages = [
        "Optimal composition threshold achieved. Ready to tapping.",
        "Silicon trace elements slightly low. FeSi addition recommended.",
        "Argon stirring active. Temperature stabilizing.",
        "Thermal deviation in Ladle Zone. Re-insulating slag boundary.",
        "Power efficiency stable at 87.4%. Induction grid optimal."
      ];
      if (Math.random() < 0.25) {
        setAiMessage(messages[Math.floor(Math.random() * messages.length)]);
      }

      setLastUpdated(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, [activeBatch]);

  // 3D Digital Twin Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let waveOffset = 0;
    const sparks: Spark[] = [];
    const smokePuffs: Smoke[] = [];

    const drawTwin = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);
      const centerX = width / 2;
      const centerY = height / 2 + 20;

      ctx.clearRect(0, 0, width, height);

      // Render camera coordinate grid underlay
      ctx.strokeStyle = 'rgba(0, 243, 255, 0.03)';
      ctx.lineWidth = 0.5;
      for (let i = -100; i <= 100; i += 20) {
        // simple flat projection grids
        ctx.beginPath();
        ctx.moveTo(centerX + i * 2, centerY - 100);
        ctx.lineTo(centerX + i * 2, centerY + 100);
        ctx.stroke();
      }

      // Projection equations
      const project = (x: number, y: number, z: number) => {
        // Rotate Y
        const cosY = Math.cos(angleY);
        const sinY = Math.sin(angleY);
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;

        // Rotate X
        const cosX = Math.cos(angleX);
        const sinX = Math.sin(angleX);
        let y2 = y * cosX - z1 * sinX;
        
        const scale = zoom * 1.5;
        return {
          x: centerX + x1 * scale,
          y: centerY - y2 * scale,
          depth: z1
        };
      };

      const isMeltActive = activeBatch && 
                           activeBatch.status !== 'STANDBY' && 
                           activeBatch.status !== 'COMPLETED';

      // Spawning sparks and smoke
      if (isMeltActive && Math.random() < 0.15) {
        sparks.push({
          x: (Math.random() - 0.5) * 50,
          y: 40, // molten surface height
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * -3 - 2,
          life: 1.0,
          color: Math.random() < 0.3 ? '#00f3ff' : '#ff8000'
        });
      }

      if (isMeltActive && Math.random() < 0.1) {
        smokePuffs.push({
          x: (Math.random() - 0.5) * 40,
          y: 50,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.8 - Math.random() * 0.8,
          size: 5 + Math.random() * 8,
          life: 1.0,
          alpha: 0.35
        });
      }

      // 1. Draw outer induction coils (3D Helix cylinder)
      ctx.lineWidth = 1;
      const segments = 16;
      const radius = 65;
      
      // Coils
      for (let coilY = -60; coilY <= 60; coilY += 20) {
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const px = radius * Math.cos(theta);
          const pz = radius * Math.sin(theta);
          const pt = project(px, coilY, pz);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.strokeStyle = isMeltActive && coilY === 0 ? 'rgba(0, 243, 255, 0.4)' : 'rgba(148, 163, 184, 0.15)';
        ctx.stroke();
      }

      // Vertical struts
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2;
        const px = radius * Math.cos(theta);
        const pz = radius * Math.sin(theta);
        const ptTop = project(px, -60, pz);
        const ptBot = project(px, 60, pz);
        ctx.beginPath();
        ctx.moveTo(ptTop.x, ptTop.y);
        ctx.lineTo(ptBot.x, ptBot.y);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
        ctx.stroke();
      }

      // 2. Draw Molten Liquid Pool (glowing ellipse at Y = 20)
      if (isMeltActive) {
        const liquidRadius = 60;
        waveOffset += 0.05;
        
        // Calculate projected molten surface polygon
        const moltenPts: {x: number, y: number}[] = [];
        for (let i = 0; i < segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          // add subtle wave offset
          const rOffset = Math.sin(theta * 3 + waveOffset) * 2;
          const px = (liquidRadius + rOffset) * Math.cos(theta);
          const pz = (liquidRadius + rOffset) * Math.sin(theta);
          const pt = project(px, 20, pz);
          moltenPts.push(pt);
        }

        ctx.beginPath();
        moltenPts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();

        // Liquid gradient
        const moltenGrad = ctx.createRadialGradient(
          centerX, centerY + 20, 5,
          centerX, centerY + 20, 80 * zoom
        );
        moltenGrad.addColorStop(0, '#ffe57f'); // Bright core
        moltenGrad.addColorStop(0.3, '#ff9100'); // Orange heat
        moltenGrad.addColorStop(0.8, '#ff3d00'); // Red slag crust
        moltenGrad.addColorStop(1, '#800c00');   // Slag edge
        ctx.fillStyle = moltenGrad;
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(255, 107, 0, 0.6)';
        ctx.fill();
        ctx.shadowBlur = 0; // reset

        // Thermal waves across molten surface
        ctx.strokeStyle = 'rgba(255, 230, 0, 0.2)';
        ctx.lineWidth = 1;
        for (let offset = -40; offset <= 40; offset += 15) {
          ctx.beginPath();
          for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const px = offset + 2 * Math.cos(theta * 2 + waveOffset);
            const pz = Math.sqrt(Math.max(0, liquidRadius**2 - px**2)) * (i > segments/2 ? -1 : 1);
            const pt = project(px, 20, pz);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        }
      }

      // 3. Draw Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.1; // gravity
        s.life -= 0.02;

        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        const pt = project(s.x, s.y, 0);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = s.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Draw Smoke Puffs
      for (let i = smokePuffs.length - 1; i >= 0; i--) {
        const s = smokePuffs[i];
        s.x += s.vx;
        s.y += s.vy;
        s.size += 0.15;
        s.life -= 0.015;

        if (s.life <= 0) {
          smokePuffs.splice(i, 1);
          continue;
        }

        const pt = project(s.x, s.y, 0);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, s.size * zoom, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 116, 139, ${s.alpha * s.life})`;
        ctx.fill();
      }

      // 5. Draw Holographic Labels pointing to the core
      if (isMeltActive) {
        const labels = [
          { label: `Fe: ${composition.Fe}%`, dx: -90, dy: -40, color: 'rgba(56, 189, 248, 0.85)' },
          { label: `Cr: ${composition.Cr}%`, dx: -90, dy: 10, color: 'rgba(0, 243, 255, 0.85)' },
          { label: `Ni: ${composition.Ni}%`, dx: -90, dy: 60, color: 'rgba(168, 85, 247, 0.85)' },
          { label: `Mn: ${composition.Mn}%`, dx: 95, dy: -30, color: 'rgba(236, 72, 153, 0.85)' },
          { label: `Si: ${composition.Si}%`, dx: 95, dy: 30, color: 'rgba(251, 146, 60, 0.85)' }
        ];

        ctx.lineWidth = 1;
        labels.forEach((l) => {
          const targetPt = project((l.dx > 0 ? 30 : -30), 20, 0);
          const textX = targetPt.x + l.dx;
          const textY = targetPt.y + l.dy;

          // Draw dotted pointer line
          ctx.beginPath();
          ctx.moveTo(targetPt.x, targetPt.y);
          ctx.lineTo(textX + (l.dx > 0 ? 0 : 50), textY + 5);
          ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Holographic bubble box
          ctx.fillStyle = 'rgba(6, 8, 12, 0.85)';
          ctx.strokeStyle = l.color;
          ctx.beginPath();
          ctx.roundRect(textX - 5, textY - 12, 75, 22, 6);
          ctx.fill();
          ctx.stroke();

          // Element text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.fillText(l.label, textX, textY + 3);
        });
      }

      animId = requestAnimationFrame(drawTwin);
    };

    drawTwin();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [angleX, angleY, zoom, composition, activeBatch]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setAngleY(prev => prev + dx * 0.007);
    setAngleX(prev => Math.max(-1.4, Math.min(0.2, prev - dy * 0.007)));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const resetCamera = () => {
    setAngleX(-0.5);
    setAngleY(0.6);
    setZoom(1.4);
  };

  const getZoneStatusColor = (status: string) => {
    switch (status) {
      case 'optimal': return 'bg-emerald-400';
      case 'warning': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const criticalZones = furnaceZones.filter(zone => zone.status === 'critical').length;
  const warningZones = furnaceZones.filter(zone => zone.status === 'warning').length;
  const avgTemperature = furnaceZones.reduce((sum, zone) => sum + zone.temperature, 0) / furnaceZones.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* 3D Digital Twin Centerpiece - 7 Cols */}
      <Card className="lg:col-span-7 bg-card border-slate-900 shadow-2xl relative overflow-hidden group min-h-[580px] flex flex-col justify-between">
        <CardHeader className="pb-2 border-b border-slate-900/60 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-outfit text-white flex items-center">
              <Flame className="h-5 w-5 mr-2 text-cyan-400 fill-cyan-400/20" />
              INDUCTION FURNACE F001 - DIGITAL TWIN
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-[10px] font-mono tracking-wider">
                3D ROTATABLE
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono text-slate-400 border-slate-800">
                L: {lastUpdated.toLocaleTimeString()}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative flex-1 p-0 flex flex-col justify-between">
          {/* Interactive 3D Render Canvas */}
          <div className="relative w-full h-[380px] cursor-grab active:cursor-grabbing">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full h-full"
            />

            {/* Standby Blur Overlay if no active smelting run */}
            {!activeBatch && !isLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                <Flame className="h-10 w-10 text-slate-600 animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-outfit">Induction Furnace Standby</h3>
                <p className="text-[11px] text-slate-400 max-w-xs font-mono">
                  No active production batch runs are currently melting. Standard standby limits active at 25.0°C.
                </p>
                <Link to="/dashboard">
                  <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-mono text-xs h-8">
                    Start New Smelt Wizard
                  </Button>
                </Link>
              </div>
            )}

            {/* Float HUD Camera Control Pad */}
            <div className="absolute left-4 bottom-4 flex flex-col space-y-1 bg-slate-950/80 border border-slate-800/80 p-1.5 rounded-lg">
              <Button size="sm" variant="ghost" onClick={() => setZoom(prev => Math.min(2.5, prev + 0.1))} className="h-7 w-7 p-0 hover:bg-slate-900 text-slate-400">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))} className="h-7 w-7 p-0 hover:bg-slate-900 text-slate-400">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={resetCamera} className="h-7 w-7 p-0 hover:bg-slate-900 text-slate-400">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Dynamic Core Melt HUD overlays */}
            <div className="absolute right-4 top-4 bg-slate-950/80 border border-slate-800/80 p-3 rounded-lg font-mono text-[10px] space-y-1.5">
              <div className="text-cyan-400 font-bold uppercase tracking-wider mb-1">Melt Parameters</div>
              <div>HEAT STAGE: <span className="text-orange-400 font-bold">{activeBatch ? (activeBatch.current_stage || "ALLOY MIXING") : "STANDBY / IDLE"}</span></div>
              <div>POWER INPUT: <span className="text-yellow-400 font-bold">{activeBatch ? "45.8 MW" : "0.0 MW"}</span></div>
              <div>TEMP DEPTH: <span className="text-red-400 font-bold">{activeBatch ? "1610 °C" : "25.0 °C"}</span></div>
              <div>SLAG COMP: <span className="text-purple-400">{activeBatch ? "OPTIMAL" : "SOLIDIFIED"}</span></div>
            </div>
          </div>

          {/* Floated Assistant Recommendations Box */}
          <div className="p-4 bg-slate-950/90 border-t border-slate-900 flex items-center space-x-3.5 shadow-inner">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(0,243,255,0.25)]">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">AI Autopilot Recommendation</div>
              <div className="text-xs text-slate-200 mt-0.5 font-outfit">{aiMessage}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telemetry Sensor Panels & Visualizer charts - 5 Cols */}
      <div className="lg:col-span-5 space-y-6">
        {/* Statistics Readouts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-mono">AVG TEMPERATURE</span>
              <Thermometer className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {avgTemperature.toFixed(0)}°C
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Active sensor limit</div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-mono">POWER GRID DRAW</span>
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {powerMetrics.current.toFixed(1)} MW
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Current line feed</div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-mono">GRID EFFICIENCY</span>
              <Gauge className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {powerMetrics.efficiency.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Induction output</div>
          </div>

          <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400 font-mono">COIL GAS FLOW</span>
              <Wind className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tracking-tight">
              {gasFlow.totalFlow.toFixed(1)} L/m
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Shielding lines</div>
          </div>
        </div>

        {/* Zones Telemetry */}
        <Card className="bg-card border-slate-900 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Zone Telemetry Sensors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {furnaceZones.map((zone) => (
              <div key={zone.id} className="p-3 bg-slate-950/30 border border-slate-900 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 font-outfit">{zone.name}</span>
                  <div className={`w-2 h-2 rounded-full ${getZoneStatusColor(zone.status)} animate-pulse`} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
                  <div>TEMP: <span className="text-white font-bold">{zone.temperature.toFixed(0)}°C</span></div>
                  <div className="text-right">TARGET: <span className="text-cyan-400">{zone.targetTemp}°C</span></div>
                </div>
                <Progress 
                  value={Math.min(100, Math.max(0, 
                    ((zone.temperature - (zone.targetTemp - zone.tolerance)) / (zone.tolerance * 2)) * 100
                  ))} 
                  className="h-1.5 bg-slate-900"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trend Logs */}
        <Card className="bg-card border-slate-900 shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Coil Heat Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={temperatureHistory}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                 <XAxis dataKey="time" stroke="#4b5563" fontSize={9} className="font-mono" />
                 <YAxis stroke="#4b5563" fontSize={9} className="font-mono" domain={[1450, 1680]} />
                 <Tooltip 
                   contentStyle={{ 
                     backgroundColor: '#090d16', 
                     border: '1px solid rgba(0,243,255,0.15)',
                     borderRadius: '6px',
                     color: '#f1f5f9',
                     fontSize: '11px',
                     fontFamily: 'JetBrains Mono'
                   }}
                 />
                <Line type="monotone" dataKey="arcZone" stroke="#f97316" strokeWidth={1.5} name="Arc" dot={false} />
                <Line type="monotone" dataKey="ladleZone" stroke="#00f3ff" strokeWidth={1.5} name="Ladle" dot={false} />
                <Line type="monotone" dataKey="tappingZone" stroke="#10b981" strokeWidth={1.5} name="Tap" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
