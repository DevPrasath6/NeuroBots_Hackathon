// MetalliSense AI Advisor Chat Component - Force Invalidate Vite Cache
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle, XCircle, Download, AlertTriangle, Play,
  FileText, Layers, ShieldCheck, Thermometer, Info, ClipboardList,
  Send, Bot, User, Sparkles, RefreshCw, AlertCircle, Wrench, Cpu, Coins, Activity, Gauge
} from 'lucide-react';
import jsPDF from 'jspdf';
import { alloyAPI } from '@/services/alloyApi';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  state?: any;
}

interface AlloyRecommendation {
  id: string;
  alloyType: string;
  quantity: number;
  unit: string;
  confidence: number;
  reason: string;
  estimatedCost: number;
  expectedImprovement: {
    element: string;
    from: number;
    to: number;
  }[];
}

export const AlloyRecommendationPanel = () => {
  // Conversational chatbot states
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `### MetalliSense Industrial AI Agent

Greetings! I am the MetalliSense Metallurgical and Production Agent. I can assist you with:
* **Alloy Recommendation & Search**: Ask me for material recommendations based on your application, e.g., *"I need an alloy for marine environments"* or *"I need a gear alloy"*.
* **Weight-based Charge Calculator**: Provide an alloy and weight, e.g., *"I need 750 kg of 316L"* to calculate exact element requirements, charge weights with recovery factors, costs, and shortages.
* **Spectrometer Deviation Audit**: Type *"Spectrometer check"* to compare furnace melt readings against targets and calculate correction trim weights.
* **Digital Twin Audit**: Ask *"What is the status of the furnace"* to get real-time induction heating telemetry.

*Please tell me what grade or application you would like to analyze!*`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dynamic Alloy Planner states
  const [selectedAlloy, setSelectedAlloy] = useState({
    name: "Stainless Steel 316L",
    grade: "316L",
    standard: "ASTM A240",
    targetWeight: 1000, // kg
    units: "kg"
  });

  const formatChargeWeight = (valueInKg: number, inputUnit: string) => {
    const isTonnes = inputUnit === 't' || inputUnit === 'tonnes' || inputUnit === 'tonne' || inputUnit === 'TONNES';
    const valT = (valueInKg / 1000.0).toFixed(3);
    const valKg = valueInKg.toFixed(0);
    if (isTonnes) {
      return `${valT} tonnes (${valKg} kg)`;
    }
    return `${valKg} kg (${valT} tonnes)`;
  };

  const [compositionElements, setCompositionElements] = useState([
    { name: "Iron (Fe)", target: 68.0, current: 67.4, color: "rgba(148, 163, 184, 0.8)", element: "Fe" },
    { name: "Chromium (Cr)", target: 17.0, current: 16.2, color: "rgba(0, 243, 255, 0.8)", element: "Cr" },
    { name: "Nickel (Ni)", target: 12.0, current: 10.8, color: "rgba(168, 85, 247, 0.8)", element: "Ni" },
    { name: "Manganese (Mn)", target: 2.0, current: 1.88, color: "rgba(236, 72, 153, 0.8)", element: "Mn" },
    { name: "Silicon (Si)", target: 0.75, current: 0.65, color: "rgba(251, 146, 60, 0.8)", element: "Si" },
    { name: "Carbon (C)", target: 0.03, current: 0.028, color: "rgba(56, 189, 248, 0.8)", element: "C" }
  ]);

  const [rawMaterials, setRawMaterials] = useState([
    { name: "Premium Scrap Steel", required: 716.2, available: 12000.0, status: "OPTIMAL", purity: "99.0%" },
    { name: "Ferrochromium (FeCr 65%)", required: 265.5, available: 5000.0, status: "OPTIMAL", purity: "65.0%" },
    { name: "Nickel Metal briquettes", required: 121.3, available: 85.0, status: "SHORTAGE", purity: "99.9%" },
    { name: "Ferrosilicon (FeSi 75%)", required: 10.0, available: 150.0, status: "OPTIMAL", purity: "75.0%" }
  ]);

  const [recipeTimeline, setRecipeTimeline] = useState([
    { stage: "Scrap Charging", duration: "15 min", detail: "Charge base scrap weight.", icon: <Layers className="h-4 w-4" /> },
    { stage: "Arc Melting", duration: "45 min", detail: "Heat core to liquidus point.", icon: <Thermometer className="h-4 w-4" /> },
    { stage: "Alloy Trimming", duration: "10 min", detail: "Slag cleaning. Add alloys charges.", icon: <AlertTriangle className="h-4 w-4" /> },
    { stage: "Spectrometer Prep", duration: "8 min", detail: "Final composition analysis verify.", icon: <ShieldCheck className="h-4 w-4" /> }
  ]);

  const [recommendations, setRecommendations] = useState<AlloyRecommendation[]>([
    {
      id: '1',
      alloyType: 'Nickel Metal',
      quantity: 36.3,
      unit: 'kg',
      confidence: 94.0,
      reason: 'Nickel content 1.2% below target in molten pool. Add pure nickel to restore compliance.',
      estimatedCost: 246.84,
      expectedImprovement: [
        { element: 'Ni', from: 10.8, to: 12.0 }
      ]
    }
  ]);

  const [shortages, setShortages] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState<number>(3420.50);
  const [mlMetrics, setMlMetrics] = useState<any>({
    expected_quality: 94.2,
    anomaly_probability: 0.0125,
    qc_pass_rate: 98.8,
    expected_duration_minutes: 78,
    power_consumption_kwh: 450.0,
    expected_defect_rate: 0.18,
    furnace_efficiency: 97.4
  });

  const [approvalStatus, setApprovalStatus] = useState<{ [key: string]: 'pending' | 'approved' | 'rejected' }>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleApproval = (id: string, status: 'approved' | 'rejected') => {
    setApprovalStatus(prev => ({ ...prev, [id]: status }));
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await alloyAPI.sendChat(text, updatedMessages);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        state: response.state
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If response includes widget updates, apply them dynamically
      if (response.widget_update && Object.keys(response.widget_update).length > 0) {
        const update = response.widget_update;
        
        if (update.alloy_code) {
          setSelectedAlloy({
            name: update.alloy_name,
            grade: update.alloy_code,
            standard: update.standard || "ASTM Standard",
            targetWeight: update.weight_kg,
            units: update.units || "kg"
          });
        }

        if (update.elements) {
          setCompositionElements(prev => prev.map(item => {
            const el = item.element;
            const target = update.elements[el] !== undefined ? update.elements[el] : item.target;
            const current = update.corrections ? (update.elements[el] || target) : (update.elements[el] * 0.95 || target);
            return {
              ...item,
              target,
              current: parseFloat(current.toFixed(3))
            };
          }));
        }

        if (update.recipe_items) {
          setRawMaterials(update.recipe_items.map((item: any) => ({
            name: item.material,
            required: item.charge_needed_kg,
            available: item.stock_available_kg,
            status: item.status,
            purity: `${item.purity}%`
          })));
        }

        if (update.timeline) {
          setRecipeTimeline(update.timeline.map((item: any, idx: number) => {
            const icons = [
              <Layers className="h-4 w-4" />,
              <Thermometer className="h-4 w-4" />,
              <AlertTriangle className="h-4 w-4" />,
              <ShieldCheck className="h-4 w-4" />
            ];
            return {
              stage: item.stage,
              duration: item.duration,
              detail: item.detail,
              icon: icons[idx % icons.length]
            };
          }));
        }

        if (update.corrections) {
          setRecommendations(update.corrections.map((corr: any, idx: number) => ({
            id: `corr_${idx}`,
            alloyType: corr.material,
            quantity: corr.charge_needed_kg,
            unit: 'kg',
            confidence: 96.0,
            reason: `Chemistry correction: ${corr.element} is low by ${corr.deficit_pct}%. Charge additional trim material.`,
            estimatedCost: corr.charge_needed_kg * 4.5,
            expectedImprovement: [
              { element: corr.element, from: corr.current, to: corr.target }
            ]
          })));
        } else {
          setRecommendations([]);
        }

        if (update.shortages) {
          setShortages(update.shortages);
        } else {
          setShortages([]);
        }

        if (update.total_cost) {
          setTotalCost(update.total_cost);
        }

        if (update.ml_metrics) {
          setMlMetrics(update.ml_metrics);
        }
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ **Communication Link Offline:** The calculation agent failed to respond. Please check if the Django backend server is running.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const runRes = await fetch('/api/smelting/current-run/');
        if (runRes.ok) {
          const runData = await runRes.json();
          if (runData && runData.run_id && runData.status !== 'STANDBY') {
            const alloyCode = runData.alloy_code || "316L";
            const weight = runData.melt_weight || 1000;
            const unit = runData.input_unit || runData.display_unit || "kg";
            setSelectedAlloy(prev => ({
              ...prev,
              grade: alloyCode,
              targetWeight: runData.target_mass_kg || weight,
              units: unit
            }));
            handleSendMessage(`Initialize analysis for active run of ${weight} ${unit} of ${alloyCode}`);
            return;
          }
        }
        
        const alloysRes = await fetch('/api/alloys/');
        if (alloysRes.ok) {
          const alloysData = await alloysRes.json();
          const results = alloysData.results || (Array.isArray(alloysData) ? alloysData : []);
          if (results.length > 0) {
            const firstAlloy = results[0];
            const code = firstAlloy.code || "316L";
            handleSendMessage(`Initialize analysis for default run of 1000 kg of ${code}`);
          }
        }
      } catch (e) {
        console.error("Failed to initialize recommendation panel from database:", e);
      }
    };
    initData();
  }, []);

  const generatePDFReport = async () => {
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = 30;
      let currentPage = 1;

      const addNewPageIfNeeded = (requiredSpace: number = 20) => {
        if (yPosition + requiredSpace > pageHeight - 30) {
          pdf.addPage();
          currentPage++;
          yPosition = 30;
          return true;
        }
        return false;
      };

      // Title Header
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      pdf.text('MetalliSense AI Recommendation Report', margin, yPosition);

      yPosition += 10;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Date Generated: ${new Date().toLocaleString()}`, margin, yPosition);

      yPosition += 15;
      pdf.setFontSize(14);
      pdf.setTextColor(51, 65, 85);
      pdf.text('1. Target Specification summary', margin, yPosition);

      yPosition += 8;
      pdf.setFontSize(10);
      pdf.text(`Grade Spec: ${selectedAlloy.grade} (${selectedAlloy.name})`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Target Weight: ${formatChargeWeight(selectedAlloy.targetWeight, selectedAlloy.units)}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Industry Compliance Standard: ${selectedAlloy.standard}`, margin, yPosition);

      yPosition += 12;
      pdf.setFontSize(14);
      pdf.text('2. Exact Raw Material Charge Recipe', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      
      rawMaterials.forEach((mat) => {
        addNewPageIfNeeded(12);
        pdf.text(`• ${mat.name} (${mat.purity} purity): Charge ${formatChargeWeight(mat.required, selectedAlloy.units)} (Status: ${mat.status})`, margin, yPosition);
        yPosition += 6;
      });

      addNewPageIfNeeded(20);
      yPosition += 6;
      pdf.setFontSize(12);
      pdf.text(`Total Charge Weight: ${formatChargeWeight(rawMaterials.reduce((sum, m) => sum + m.required, 0), selectedAlloy.units)}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`Estimated Heat Cost: $${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin, yPosition);

      yPosition += 15;
      pdf.setFontSize(14);
      pdf.text('3. AI Machine Learning Predictions', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      pdf.text(`• Expected Quality Score: ${mlMetrics.expected_quality}%`, margin, yPosition);
      yPosition += 6;
      pdf.text(`• Anomaly Probability: ${(mlMetrics.anomaly_probability * 100).toFixed(3)}%`, margin, yPosition);
      yPosition += 6;
      pdf.text(`• Defect Probability: ${mlMetrics.expected_defect_rate}%`, margin, yPosition);
      yPosition += 6;
      pdf.text(`• Expected Power Required: ${mlMetrics.power_consumption_kwh} kWh`, margin, yPosition);

      pdf.save(`MetalliSense_Report_${selectedAlloy.grade}_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
    if (confidence >= 80) return 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30';
    return 'text-orange-400 bg-orange-950/40 border-orange-500/30';
  };

  // Helper function to render text containing custom markdown patterns
  const parseInlineFormat = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} className="text-white font-semibold">{part}</strong>;
      }
      return part;
    });
  };

  const RenderMarkdown = ({ text }: { text: string }) => {
    if (!text) return null;
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentTable: any[] = [];
    let isTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|')) {
        isTable = true;
        const cells = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (line.includes(':---') || line.includes('---')) {
          continue;
        }
        currentTable.push(cells);
        continue;
      } else if (isTable) {
        if (currentTable.length > 0) {
          const tableKey = `table-${i}`;
          elements.push(
            <div key={tableKey} className="overflow-x-auto my-3 border border-slate-900 rounded-lg">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-900 text-[10px] uppercase font-mono text-cyan-400">
                    {currentTable[0].map((h: string, idx: number) => (
                      <th key={idx} className="p-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 bg-slate-950/20 text-[11px] text-slate-300">
                  {currentTable.slice(1).map((row: string[], rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-900/20 transition-colors">
                      {row.map((cell: string, cIdx: number) => (
                        <td key={cIdx} className="p-2.5 font-mono">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        currentTable = [];
        isTable = false;
      }

      if (line === '') continue;

      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-[13px] font-semibold font-outfit uppercase tracking-wider text-white mt-4 mb-2">{line.replace('## ', '')}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-[11px] font-semibold font-mono uppercase tracking-widest text-cyan-400 mt-3 mb-1.5">{line.replace('### ', '')}</h3>);
      } else if (line.startsWith('>')) {
        const cleanLine = line.replace('>', '').trim();
        if (cleanLine.includes('[!WARNING]')) {
          elements.push(
            <div key={i} className="bg-orange-950/40 border border-orange-500/30 text-orange-400 p-3 rounded-lg text-xs my-2 font-outfit flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Shortage Alert:</strong> {lines[++i].replace('>', '').trim()}</span>
            </div>
          );
        } else if (cleanLine.includes('[!IMPORTANT]')) {
          elements.push(
            <div key={i} className="bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 p-3 rounded-lg text-xs my-2 font-outfit flex items-start space-x-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span><strong>Recipe Notice:</strong> {lines[++i].replace('>', '').trim()}</span>
            </div>
          );
        }
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        elements.push(
          <li key={i} className="text-xs text-slate-300 ml-4 list-disc list-outside my-1 font-outfit">
            {parseInlineFormat(line.substring(2))}
          </li>
        );
      } else {
        elements.push(
          <p key={i} className="text-xs text-slate-300 leading-relaxed my-2 font-outfit">
            {parseInlineFormat(line)}
          </p>
        );
      }
    }

    if (isTable && currentTable.length > 0) {
      elements.push(
        <div key="table-final" className="overflow-x-auto my-3 border border-slate-900 rounded-lg">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-900 text-[10px] uppercase font-mono text-cyan-400">
                {currentTable[0].map((h: string, idx: number) => (
                  <th key={idx} className="p-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 bg-slate-950/20 text-[11px] text-slate-300">
              {currentTable.slice(1).map((row: string[], rIdx: number) => (
                <tr key={rIdx} className="hover:bg-slate-900/20 transition-colors">
                  {row.map((cell: string, cIdx: number) => (
                    <td key={cIdx} className="p-2.5 font-mono">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return <div className="space-y-1">{elements}</div>;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
      {/* LEFT PANEL: AI Agent Conversational Chat (col-span-5) */}
      <Card className="xl:col-span-5 bg-card border-slate-900 shadow-2xl relative overflow-hidden h-[730px] flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600"></div>
        <CardHeader className="pb-4 border-b border-slate-900/60 bg-slate-950/40 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-outfit text-white uppercase tracking-wider">METALLISENSE AI ADVISOR</CardTitle>
              <CardDescription className="text-xs font-mono text-cyan-500">Experienced Industrial Alloy Intelligence Agent</CardDescription>
            </div>
          </div>
        </CardHeader>
        
        {/* Chat History View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 scrollbar-thin scrollbar-thumb-slate-900">
          {messages.map((msg, index) => (
            <div 
              key={index} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] rounded-2xl p-4 text-xs shadow-md ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-cyan-900/60 to-blue-900/60 border border-cyan-800/40 text-slate-100 rounded-tr-none' 
                  : 'bg-slate-950/80 border border-slate-900 text-slate-200 rounded-tl-none'
              }`}>
                <div className="flex items-center space-x-1.5 mb-2 font-mono text-[9px] text-cyan-500 uppercase tracking-widest">
                  {msg.role === 'user' ? (
                    <>
                      <User className="h-3 w-3" />
                      <span>OPERATOR</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 text-cyan-400 animate-pulse" />
                      <span>AI METALLURGIST</span>
                    </>
                  )}
                </div>
                <div className="leading-relaxed">
                  {msg.role === 'user' ? msg.content : <RenderMarkdown text={msg.content} />}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-950/80 border border-slate-900 rounded-2xl rounded-tl-none p-4 max-w-[80%] flex items-center space-x-3 text-xs text-slate-400">
                <RefreshCw className="h-4 w-4 animate-spin text-cyan-400" />
                <span className="font-mono text-[10px] tracking-wider uppercase">AI Reasoning Pipeline Executing...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 bg-slate-950/40 border-t border-slate-900 shrink-0 flex flex-wrap gap-2">
          <button 
            onClick={() => handleSendMessage("I need an alloy for food processing")}
            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            🍔 Food grade recommendations
          </button>
          <button 
            onClick={() => handleSendMessage("I need 500 kg of 316L")}
            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            ⚖️ 500 kg SS316L calculations
          </button>
          <button 
            onClick={() => handleSendMessage("Spectrometer check")}
            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            🔬 Correct spectrometer deviation
          </button>
          <button 
            onClick={() => handleSendMessage("What is the status of the furnace")}
            className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
          >
            🖥️ Digital Twin telemetry status
          </button>
        </div>

        {/* Chat Input Box */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-900 shrink-0">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }} 
            className="flex items-center space-x-2"
          >
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask for recommendations, specify batch weight, or run spec checks..."
              className="flex-1 bg-slate-950/80 border-slate-900 text-xs text-white placeholder-slate-600 focus-visible:ring-cyan-500"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !inputValue.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* RIGHT PANEL: Dynamic Alloy Planning & plan widgets (col-span-7) */}
      <div className="xl:col-span-7 space-y-8 h-[730px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-900">
        
        {/* Dynamic composition rings */}
        <Card className="bg-card border-slate-900 shadow-xl relative overflow-hidden">
          <CardHeader className="pb-4 border-b border-slate-900/60 bg-slate-950/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <ClipboardList className="h-5 w-5 text-cyan-400" />
                <div>
                  <CardTitle className="text-md font-outfit text-white uppercase tracking-wider">ALLOY COMPOSITION RECIPE</CardTitle>
                  <CardDescription className="text-xs font-mono text-cyan-500">Real-time elemental target configurations</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 font-mono text-[10px]">
                {selectedAlloy.grade} Target Set
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-950/40 border border-slate-900 rounded-xl font-mono text-[11px] text-slate-300">
              <div>GRADE SPEC: <span className="text-cyan-400 font-bold">{selectedAlloy.grade}</span></div>
              <div>STANDARD: <span className="text-slate-400">{selectedAlloy.standard}</span></div>
              <div>TARGET MASS: <span className="text-white font-bold">{formatChargeWeight(selectedAlloy.targetWeight, selectedAlloy.units)}</span></div>
              <div className="col-span-2">ESTIMATED MASS COST: <span className="text-emerald-400 font-bold">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
            </div>

            <div>
              <h4 className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-4">Nominal Element Targets</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {compositionElements.map((elem, idx) => {
                  const percentage = (elem.current / elem.target) * 100;
                  return (
                    <div key={idx} className="p-3 bg-slate-950/20 border border-slate-900 rounded-lg flex flex-col justify-between hover:border-slate-800 transition-colors">
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="font-semibold text-slate-300">{elem.name}</span>
                        <span className="font-mono text-cyan-400 font-bold">{elem.current}%</span>
                      </div>
                      
                      <div className="flex justify-center my-1">
                        <svg className="w-12 h-12 transform -rotate-90">
                          <circle cx="24" cy="24" r="20" stroke="rgba(15,23,42,0.6)" strokeWidth="3" fill="transparent" />
                          <circle 
                            cx="24" cy="24" r="20" 
                            stroke={elem.color} 
                            strokeWidth="3" 
                            fill="transparent" 
                            strokeDasharray={125}
                            strokeDashoffset={125 - (125 * Math.min(100, percentage)) / 100}
                          />
                        </svg>
                      </div>

                      <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-2">
                        <span>EST: {elem.current}%</span>
                        <span>NOM: {elem.target}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Raw materials & timelines */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Inventory charge lists */}
          <Card className="bg-card border-slate-900 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Inventory Raw Materials check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {rawMaterials.map((mat, idx) => (
                <div key={idx} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-xs">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-bold text-slate-200">{mat.name}</span>
                    <Badge className={mat.status === "OPTIMAL" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[9px] py-0.5" : "bg-red-950/80 text-red-400 border border-red-500/30 text-[9px] py-0.5 animate-pulse"}>
                      {mat.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-1 font-mono text-[9px] text-slate-400">
                    <div>PURITY: {mat.purity}</div>
                    <div>REQUIRED: {formatChargeWeight(mat.required, selectedAlloy.units)}</div>
                    <div className="text-right">STOCK: {formatChargeWeight(mat.available, selectedAlloy.units)}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI Heat Recipe timeline */}
          <Card className="bg-card border-slate-900 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest">AI Heat Recipe Sequence</CardTitle>
            </CardHeader>
            <CardContent className="relative pl-6 border-l border-slate-800 space-y-4 ml-4 py-3 text-xs">
              {recipeTimeline.map((item, idx) => (
                <div key={idx} className="relative text-xs">
                  <span className="absolute -left-[31px] top-0 p-1 bg-slate-950 border border-cyan-400 rounded-full text-cyan-400 shadow-[0_0_10px_rgba(0,243,255,0.3)]">
                    {item.icon}
                  </span>
                  <div className="font-bold text-slate-200 flex items-center justify-between">
                    <span>{item.stage}</span>
                    <Badge variant="outline" className="font-mono text-[8px] text-cyan-400 border-cyan-500/20 py-0">{item.duration}</Badge>
                  </div>
                  <p className="text-slate-400 text-[10px] mt-0.5 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Spectrometer correction trim recommendations */}
        {recommendations.length > 0 && (
          <Card className="bg-card border-slate-900 shadow-xl border-orange-500/20">
            <CardHeader className="pb-3 border-b border-slate-900 bg-slate-950/40">
              <CardTitle className="text-xs font-mono text-orange-400 uppercase tracking-widest flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Active Spectrometer Corrections
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {recommendations.map((rec) => {
                const status = approvalStatus[rec.id] || 'pending';
                return (
                  <div key={rec.id} className="bg-slate-950/40 border border-slate-900 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 text-xs">{rec.alloyType}</span>
                        <Badge className={`${getConfidenceColor(rec.confidence)} font-mono text-[9px] py-0`}>
                          {rec.confidence}% Confidence
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {status === 'pending' && (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleApproval(rec.id, 'approved')}
                              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-[10px] h-7 px-2"
                            >
                              Approve
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleApproval(rec.id, 'rejected')}
                              className="text-[10px] h-7 px-2 border-slate-800 text-slate-400"
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {status === 'approved' && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] py-0">
                            Approved
                          </Badge>
                        )}
                        {status === 'rejected' && (
                          <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] py-0">
                            Rejected
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-300">{rec.reason}</p>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-slate-400">
                      <div>CHARGE WEIGHT: <span className="text-white font-bold">+{formatChargeWeight(rec.quantity, selectedAlloy.units)}</span></div>
                      <div>ESTIMATED COST: <span className="text-white font-bold">${rec.estimatedCost.toFixed(2)}</span></div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Report Download and pdf generation section */}
        <div className="flex justify-between items-center bg-slate-950/40 border border-slate-900 rounded-xl p-5 shadow-lg">
          <div>
            <h3 className="font-semibold text-slate-200 text-xs font-mono uppercase tracking-wider">Report Generation</h3>
            <p className="text-[10px] text-slate-400 mt-1">Download comprehensive batch plan & AI recommendations analysis</p>
          </div>
          <Button
            variant="outline"
            className="glass-button text-xs border-slate-800 text-slate-300 hover:text-white"
            onClick={generatePDFReport}
            disabled={isGeneratingPDF}
          >
            <Download className="h-4 w-4 mr-1.5" />
            {isGeneratingPDF ? 'Generating PDF...' : 'Download PDF Report'}
          </Button>
        </div>

      </div>
    </div>
  );
};

export default AlloyRecommendationPanel;
