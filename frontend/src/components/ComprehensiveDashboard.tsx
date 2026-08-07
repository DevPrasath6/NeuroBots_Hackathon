import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    TrendingUp,
    Zap,
    Target,
    DollarSign,
    Clock,
    CheckCircle,
    BarChart3,
    PieChart,
    Activity,
    Boxes,
    Cpu,
    Flame
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { dataService } from '@/services/dataService';
import { getModelAccuracy, ModelAccuracy } from '@/services/modelAccuracy';

export const ComprehensiveDashboard = () => {
    const [analytics, setAnalytics] = useState({
        totalReadings: 0,
        avgQuality: 0,
        criticalAlerts: 0,
        avgConfidence: 0,
        systemUptime: 0,
        energyEfficiency: 0,
        costSavings: 0
    });

    const [modelAccuracy, setModelAccuracy] = useState<ModelAccuracy | null>(null);
    const [qualityTrends, setQualityTrends] = useState<any[]>([]);
    const [elementDistribution, setElementDistribution] = useState<any[]>([]);

    // Furnace utilization state
    const [furnaces] = useState([
      { id: "F001", status: "ACTIVE MELTING", load: 92, temp: 1610, color: "text-orange-400 border-orange-500/30" },
      { id: "F002", status: "CHARGING SEQUENCE", load: 35, temp: 850, color: "text-yellow-400 border-yellow-500/30" },
      { id: "F003", status: "OFFLINE - MAINT", load: 0, temp: 25, color: "text-slate-500 border-slate-800" }
    ]);

    // Active production batch step
    const [activeBatchStep, setActiveBatchStep] = useState(3); // 0-indexed
    const steps = [
      { name: "Scrap Load", desc: "Charging metal scrap" },
      { name: "Melting", desc: "Arc induction active" },
      { name: "Trim Additions", desc: "AI trim recommendations" },
      { name: "Refining", desc: "Argon stirring & clean" },
      { name: "Ladle Pour", desc: "Transferring batch" }
    ];

    useEffect(() => {
        const loadAccuracy = async () => {
            try {
                const data = await getModelAccuracy();
                setModelAccuracy(data);
            } catch (error) {
                console.error('Failed to load model accuracy:', error);
            }
        };
        loadAccuracy();

        const fetchData = async () => {
            const [analyticsData, recentData] = await Promise.all([
                dataService.getSystemAnalytics(),
                dataService.getRecentProcessData(24)
            ]);

            setAnalytics({
                ...analyticsData,
                avgConfidence: modelAccuracy?.averageAccuracy || 85.57
            });

            // Generate quality trends
            const trends = recentData.slice(0, 8).map((reading, index) => ({
                time: new Date(reading.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                quality: reading.quality_score || 85,
                efficiency: 82 + Math.random() * 12,
                energy: 40 + Math.random() * 8
            }));
            setQualityTrends(trends.reverse());

            // Generate element distribution
            if (recentData.length > 0) {
                const latest = recentData[0];
                const distribution = Object.entries(latest.composition).map(([element, value]) => ({
                    element,
                    value: Number(value),
                    color: element === 'C' ? '#ef4444' :
                        element === 'Si' ? '#38bdf8' :
                        element === 'Mn' ? '#10b981' :
                        element === 'Ni' ? '#a855f7' :
                        element === 'Cr' ? '#00f3ff' : '#f59e0b'
                }));
                setElementDistribution(distribution);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [modelAccuracy?.averageAccuracy]);

    const kpiCards = [
        {
            title: 'Process Quality Level',
            value: `${analytics.avgQuality.toFixed(1)}%`,
            change: '+2.4%',
            isPositive: true,
            icon: Target,
            color: 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
        },
        {
            title: 'Digital Twin Uptime',
            value: `${analytics.systemUptime.toFixed(1)}%`,
            change: '+0.1%',
            isPositive: true,
            icon: Clock,
            color: 'text-blue-400 bg-blue-950/40 border border-blue-500/30'
        },
        {
            title: 'Thermal Efficiency',
            value: `${analytics.energyEfficiency.toFixed(1)}%`,
            change: '+1.8%',
            isPositive: true,
            icon: Zap,
            color: 'text-yellow-400 bg-yellow-950/40 border border-yellow-500/30'
        },
        {
            title: 'AI Trim Savings',
            value: `$${analytics.costSavings.toFixed(2)}`,
            change: '+12.5%',
            isPositive: true,
            icon: DollarSign,
            color: 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/30'
        }
    ];

    return (
        <div className="space-y-8">
            {/* KPI Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((kpi, index) => (
                    <Card key={index} className="bg-card border-slate-900 hover:scale-[1.02] transition-transform duration-300">
                        <CardContent className="p-5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{kpi.title}</p>
                                <p className="text-2xl font-black font-mono text-white mt-1.5">{kpi.value}</p>
                                <div className="flex items-center mt-1 text-[11px] font-mono">
                                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                                    <span className="text-emerald-400 font-bold">{kpi.change}</span>
                                    <span className="text-slate-500 ml-1">vs yesterday</span>
                                </div>
                            </div>
                            <div className={`p-3 rounded-xl ${kpi.color} shadow-lg`}>
                                <kpi.icon className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Live Furnace Utilization & Active Batch Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Active Furnaces Grid - 5 Cols */}
              <Card className="lg:col-span-5 bg-card border-slate-900 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                    <Flame className="h-4 w-4 mr-2" />
                    FURNACE COCKPIT UTILIZATION
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {furnaces.map((furnace, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="font-bold text-white uppercase tracking-wider">FURNACE {furnace.id}</div>
                        <div className="text-[10px] text-slate-400 mt-1 uppercase">STAGE: <span className="font-bold text-slate-300">{furnace.status}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-white">{furnace.load}% LOAD</div>
                        <div className="text-[10px] text-cyan-400 mt-1">{furnace.temp}°C CORE</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Active Batch Progress Timeline - 7 Cols */}
              <Card className="lg:col-span-7 bg-card border-slate-900 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                    <Activity className="h-4 w-4 mr-2 animate-pulse" />
                    ACTIVE BATCH PIPELINE (B-7492-X)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {/* Step bar */}
                  <div className="grid grid-cols-5 gap-2 text-center text-[10px] font-mono mb-4">
                    {steps.map((s, idx) => (
                      <div key={idx} className={`p-2 rounded-lg border transition-all ${idx <= activeBatchStep ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-400' : 'bg-slate-950/40 border-slate-900 text-slate-600'}`}>
                        <div className="font-bold uppercase tracking-wider">{s.name}</div>
                        <div className="text-[8px] text-slate-400 mt-0.5 hidden sm:block">{s.desc}</div>
                      </div>
                    ))}
                  </div>
                  <Progress value={((activeBatchStep + 1) / steps.length) * 100} className="h-2 bg-slate-950" />
                </CardContent>
              </Card>
            </div>

            {/* Quality & Efficiency Trends vs Element Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Area charts quality - 7 Cols */}
                <Card className="lg:col-span-7 bg-card border-slate-900 shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                            <BarChart3 className="h-4 w-4 mr-2" />
                            QUALITY & THERMAL TREND LOGS
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={qualityTrends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                                <XAxis dataKey="time" stroke="#4b5563" fontSize={10} fontClassName="font-mono" />
                                <YAxis stroke="#4b5563" fontSize={10} fontClassName="font-mono" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#090d16',
                                        border: '1px solid rgba(0,243,255,0.15)',
                                        borderRadius: '6px',
                                        color: '#cbd5e1',
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: '11px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="quality"
                                    stroke="#00f3ff"
                                    fill="rgba(0, 243, 255, 0.05)"
                                    strokeWidth={2}
                                    name="Quality %"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="efficiency"
                                    stroke="#10b981"
                                    fill="rgba(16, 185, 129, 0.03)"
                                    strokeWidth={1.5}
                                    name="Thermal Eff %"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Pie chart elements - 5 Cols */}
                <Card className="lg:col-span-5 bg-card border-slate-900 shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                            <PieChart className="h-4 w-4 mr-2" />
                            CURRENT MELT DISTRIBUTION
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex justify-center">
                        <ResponsiveContainer width="100%" height={260}>
                            <RechartsPieChart>
                                <Pie
                                    data={elementDistribution}
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={75}
                                    innerRadius={50}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ element, value }) => `${element}: ${value.toFixed(1)}%`}
                                >
                                    {elementDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#090d16',
                                        border: '1px solid rgba(0,243,255,0.15)',
                                        borderRadius: '6px',
                                        color: '#cbd5e1',
                                        fontFamily: 'JetBrains Mono',
                                        fontSize: '11px'
                                    }}
                                />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Neural System Diagnostics */}
            <Card className="bg-card border-slate-900 shadow-xl">
                <CardHeader className="pb-2 border-b border-slate-900/60 bg-slate-950/40">
                    <CardTitle className="text-xs font-mono text-cyan-400 uppercase tracking-widest flex items-center">
                      <Cpu className="h-4 w-4 mr-2 animate-spin-slow text-purple-400" />
                      Neural Autopilot Diagnostics
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Telemetry Quality</h4>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-xs font-mono mb-1.5">
                                        <span className="text-slate-400">Stream Accuracy</span>
                                        <span className="text-cyan-400 font-bold">98.5%</span>
                                    </div>
                                    <Progress value={98.5} className="h-1.5 bg-slate-950" />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-mono mb-1.5">
                                        <span className="text-slate-400">Model Autopilot Confidence</span>
                                        <span className="text-purple-400 font-bold">{analytics.avgConfidence.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={analytics.avgConfidence} className="h-1.5 bg-slate-950" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Operator Action Alarms</h4>
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-slate-400">Active Critical Alerter:</span>
                                    <Badge className={analytics.criticalAlerts > 0 ? 'bg-orange-600 animate-pulse text-white' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'}>
                                        {analytics.criticalAlerts} ALERTS
                                    </Badge>
                                </div>
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-slate-400">Sensory Autopilot Status:</span>
                                    <div className="flex items-center space-x-1.5">
                                        <CheckCircle className="h-4 w-4 text-emerald-400 animate-pulse" />
                                        <span className="text-emerald-400 font-bold">STABLE</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Engine Performance</h4>
                            <div className="space-y-2.5 text-xs font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Ingested Telemetry Packets:</span>
                                    <span className="text-white font-bold">{analytics.totalReadings.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Ladle Refine Response Latency:</span>
                                    <span className="text-cyan-400 font-bold">2.3 ms</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Core Engine Throughput:</span>
                                    <span className="text-purple-400 font-bold">1,200 runs/hr</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
export default ComprehensiveDashboard;
