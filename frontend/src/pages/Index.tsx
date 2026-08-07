import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Database, BarChart3, Bell, Package, Lightbulb, TrendingUp,
    Activity, Shield, Zap, Brain, Sparkles, ArrowRight,
    Play, Pause, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FeatureLauncher from '@/components/FeatureLauncher';
import { ModelAccuracyDisplay } from '@/components/ModelAccuracyDisplay';
import { MoltenSculptureCanvas } from '@/components/MoltenSculptureCanvas';

const Index = () => {
    const navigate = useNavigate();
    const [currentMetric, setCurrentMetric] = useState(0);
    const [isAutoRotating, setIsAutoRotating] = useState(true);
    const [activeSlide, setActiveSlide] = useState(0);

    const [hoverCTA1, setHoverCTA1] = useState(false);
    const [hoverCTA2, setHoverCTA2] = useState(false);
    const [transitionProgress, setTransitionProgress] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    const [liveStats, setLiveStats] = useState({
        activeBatches: 0,
        inventoryItems: 0,
        loggedAnomalies: 0,
        mlAccuracy: 98.29,
        modelStatus: 'PRODUCTION READY'
    });

    const handleLaunchClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isTransitioning) return;
        setIsTransitioning(true);

        const duration = 1000; // 1 second
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(1.0, elapsed / duration);
            setTransitionProgress(progress);

            if (progress < 1.0) {
                requestAnimationFrame(animate);
            } else {
                navigate('/dashboard');
            }
        };
        requestAnimationFrame(animate);
    };

    useEffect(() => {
        // Query active batches
        fetch('/api/batches/')
            .then(res => res.json())
            .then(data => {
                const count = data.count !== undefined ? data.count : (Array.isArray(data) ? data.length : 0);
                setLiveStats(prev => ({ ...prev, activeBatches: count }));
            })
            .catch(err => console.warn('Error fetching batches count:', err));

        // Query inventory materials
        fetch('/api/inventories/')
            .then(res => res.json())
            .then(data => {
                const count = data.count !== undefined ? data.count : (Array.isArray(data) ? data.length : 0);
                setLiveStats(prev => ({ ...prev, inventoryItems: count }));
            })
            .catch(err => console.warn('Error fetching inventories count:', err));

        // Query logged anomalies
        fetch('/api/anomalies/')
            .then(res => res.json())
            .then(data => {
                const count = data.count !== undefined ? data.count : (Array.isArray(data) ? data.length : 0);
                setLiveStats(prev => ({ ...prev, loggedAnomalies: count }));
            })
            .catch(err => console.warn('Error fetching anomalies count:', err));

        // Query model performance registry
        fetch('/api/models/performance/')
            .then(res => res.json())
            .then(data => {
                setLiveStats(prev => ({
                    ...prev,
                    mlAccuracy: data.overall_accuracy || 98.29,
                    modelStatus: data.model_status || 'PRODUCTION READY'
                }));
            })
            .catch(err => console.warn('Error fetching model performance:', err));
    }, []);

    const features = [
        {
            icon: <Database className="h-6 w-6" />,
            title: "AI-Powered Dashboard",
            description: "Real-time intelligent furnace monitoring with predictive telemetry insights.",
            href: "/dashboard",
            gradient: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-400",
            delay: "0ms"
        },
        {
            icon: <BarChart3 className="h-6 w-6" />,
            title: "Advanced Analytics",
            description: "Deep learning algorithms for process optimization and statistical variance modeling.",
            href: "/analytics",
            gradient: "from-purple-500/20 to-indigo-500/20 border-purple-500/30 text-purple-400",
            delay: "100ms"
        },
        {
            icon: <Brain className="h-6 w-6" />,
            title: "Neural Networks",
            description: "Multi-layered machine learning predictions for precise alloy composition adjustments.",
            href: "/recommendations",
            gradient: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-400",
            delay: "200ms"
        },
        {
            icon: <TrendingUp className="h-6 w-6" />,
            title: "Predictive Modeling",
            description: "Future degradation forecasting and thermal drift detection with 99.2% accuracy.",
            href: "/predictive",
            gradient: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400",
            delay: "300ms"
        },
        {
            icon: <Shield className="h-6 w-6" />,
            title: "Quality Assurance",
            description: "Automated standard grade compliance check with instant tolerance analysis.",
            href: "/quality",
            gradient: "from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400",
            delay: "400ms"
        },
        {
            icon: <Bell className="h-6 w-6" />,
            title: "Smart Alerts",
            description: "Intelligent operator notification panel with 3-sigma anomaly prioritization.",
            href: "/alerts",
            gradient: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400",
            delay: "500ms"
        }
    ];

    const metrics = [
        { 
            value: `${liveStats.activeBatches}`, 
            label: "Active Production Batches", 
            description: "Real batches registered in database" 
        },
        { 
            value: `${liveStats.mlAccuracy}%`, 
            label: "AI Model Accuracy", 
            description: `Registry status: ${liveStats.modelStatus}` 
        },
        { 
            value: `${liveStats.inventoryItems}`, 
            label: "Inventory Materials", 
            description: "Registered raw metallurgical materials" 
        },
        { 
            value: `${liveStats.loggedAnomalies}`, 
            label: "Logged Anomalies", 
            description: "Identified deviations and safety checks" 
        }
    ];

    const testimonials = [
        {
            quote: "Revolutionary AI platform that transformed our metallurgy operations with high-precision additions.",
            author: "Dr. Sarah Chen",
            role: "Chief Metallurgist, TechAlloy Corp"
        },
        {
            quote: "Unprecedented precision in alloy composition prediction and thermal anomaly warning signs.",
            author: "Michael Rodriguez",
            role: "Process Engineer, Advanced Materials Ltd"
        },
        {
            quote: "The absolute future of intelligent metallurgy control centers is right here.",
            author: "Prof. James Wilson",
            role: "Materials Science Institute"
        }
    ];

    useEffect(() => {
        document.title = 'MetalliSense — AI Smelting & Voice Safety Assistant';
        const meta = document.querySelector('meta[name="description"]');
        if (meta) {
            meta.setAttribute('content', 'MetalliSense - Real-time AI voice safety assistant and dynamic composite smelting optimization engine.');
        }
    }, []);

    // Metric rotation
    useEffect(() => {
        if (isAutoRotating) {
            const interval = setInterval(() => {
                setCurrentMetric((prev) => (prev + 1) % metrics.length);
            }, 3500);
            return () => clearInterval(interval);
        }
    }, [isAutoRotating, metrics.length]);

    // Testimonial Carousel AutoPlay
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % testimonials.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [testimonials.length]);

    const handlePrevSlide = () => {
        setActiveSlide((prev) => (prev - 1 + testimonials.length) % testimonials.length);
    };

    const handleNextSlide = () => {
        setActiveSlide((prev) => (prev + 1) % testimonials.length);
    };

    return (
        <div className="min-h-screen bg-transparent gradient-mesh font-inter text-slate-100 relative overflow-hidden">

            {/* Floating Futuristic Header */}
            <header 
                className="fixed top-0 left-0 right-0 z-50 glass-header"
                style={{ opacity: 1.0 - transitionProgress, pointerEvents: isTransitioning ? 'none' : 'auto', transition: 'opacity 0.2s ease-out' }}
            >
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-900 shadow-[0_0_15px_rgba(0,243,255,0.4)]">
                                    <Database className="h-6 w-6 fill-slate-950" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                            </div>
                            <div>
                                <h1 className="text-xl font-extrabold font-outfit tracking-tight text-gradient">
                                    MetalliSense
                                </h1>
                                <p className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase">AI Smelting Safety Advisor</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="border border-slate-800 bg-slate-950/60 px-3.5 py-1.5 rounded-full flex items-center space-x-2 font-mono text-[10px]">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span className="text-slate-300">CORE STATUS: OPTIMAL</span>
                            </div>

                            <Link to="/dashboard" onClick={handleLaunchClick}>
                                <Button className="glass-button text-xs py-1.5 px-3">
                                    <Shield className="h-3.5 w-3.5 mr-1.5 text-cyan-400" />
                                    Operator Access
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main 
                className="pt-24 relative z-10"
                style={{ opacity: 1.0 - transitionProgress, pointerEvents: isTransitioning ? 'none' : 'auto', transition: 'opacity 0.2s ease-out' }}
            >
                <section className="relative overflow-hidden min-h-[90vh] flex items-center justify-center py-12">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,243,255,0.02),transparent_70%)] pointer-events-none"></div>
                    <div className="container mx-auto px-6 relative z-10">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                            {/* Left Column (Left-Aligned Hero Content) */}
                            <div className="lg:col-span-7 text-left flex flex-col items-start">
                                {/* Floating Badge */}
                                <div className="inline-flex items-center space-x-3 bg-slate-950/60 border border-cyan-500/25 px-5 py-2.5 rounded-full mb-8 shadow-[0_0_15px_rgba(0,243,255,0.1)]">
                                    <Brain className="h-4 w-4 text-cyan-400" />
                                    <span className="text-xs font-mono tracking-widest text-slate-300 uppercase">MetalliSense Industrial AI Smelting Platform</span>
                                    <Sparkles className="h-3.5 w-3.5 text-orange-400 animate-pulse" />
                                </div>

                                {/* Hero Title */}
                                <h1 className="text-5xl md:text-7xl font-black font-outfit tracking-tighter mb-6 leading-tight text-left">
                                    <span className="text-gradient">METALLISENSE</span>
                                    <br />
                                    <span className="text-slate-200">SAFETY & SMELTING</span>
                                </h1>

                                {/* Hero Description */}
                                <p className="text-base md:text-lg text-slate-400 text-left mb-10 leading-relaxed max-w-2xl">
                                    Real-time AI voice safety assistant and dynamic composite smelting optimization engine. Connects directly to digital twin telemetry, OES spectrometer analysis, and raw material inventory for automated safety checks and taps.
                                </p>

                                {/* Hero Actions */}
                                <div className="flex flex-col sm:flex-row gap-4 justify-start mb-12 w-full sm:w-auto">
                                    <Link to="/dashboard" onClick={handleLaunchClick}>
                                        <Button 
                                            size="lg" 
                                            onMouseEnter={() => setHoverCTA1(true)}
                                            onMouseLeave={() => setHoverCTA1(false)}
                                            className="w-full sm:w-auto px-8 py-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-outfit font-bold rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center group"
                                        >
                                            <Activity className="h-5 w-5 mr-3 text-slate-950 fill-slate-950" />
                                            Launch Control Console
                                            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                        </Button>
                                    </Link>
                                    <Link to="/recommendations">
                                        <Button 
                                            variant="outline" 
                                            size="lg" 
                                            onMouseEnter={() => setHoverCTA2(true)}
                                            onMouseLeave={() => setHoverCTA2(false)}
                                            className="w-full sm:w-auto glass-button px-8 py-6 text-slate-200 rounded-xl hover:scale-[1.02] flex items-center justify-center"
                                        >
                                            <Zap className="h-5 w-5 mr-3 text-cyan-400" />
                                            AI Recommendations
                                        </Button>
                                    </Link>
                                </div>

                                {/* Live Telemetry Metric Display */}
                                <div className="glass-card p-6 rounded-2xl w-full max-w-md border border-cyan-500/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(circle_at_top_right,rgba(0,243,255,0.08),transparent)] pointer-events-none"></div>
                                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900/60">
                                        <h3 className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">SYS TELEMETRY MONITORS</h3>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setIsAutoRotating(!isAutoRotating)}
                                            className="h-7 px-2 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200"
                                        >
                                            {isAutoRotating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>

                                    <div className="text-left py-2">
                                        <div className="text-4xl font-extrabold font-mono text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] mb-2">
                                            {metrics[currentMetric].value}
                                        </div>
                                        <div className="text-sm font-semibold font-outfit text-slate-200 mb-1">
                                            {metrics[currentMetric].label}
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">
                                            {metrics[currentMetric].description}
                                        </div>
                                    </div>

                                    <div className="flex justify-start space-x-2 mt-4">
                                        {metrics.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentMetric(index)}
                                                className={`h-1 rounded-full transition-all duration-300 ${index === currentMetric ? 'bg-cyan-400 w-6' : 'bg-slate-800 w-2'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (Centerpiece 3D Interactive Sculpture) */}
                            <div className="lg:col-span-5 flex items-center justify-center min-h-[450px]">
                                <MoltenSculptureCanvas />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quick Launch Panel */}
                <section aria-labelledby="quick-launch" className="py-16 relative">
                    <div className="container mx-auto px-6">
                        <div className="flex items-center space-x-3 mb-8">
                            <Zap className="h-5 w-5 text-orange-400" />
                            <h2 id="quick-launch" className="text-xs font-mono tracking-widest text-slate-300 uppercase">QUICK RUN ACTIONS</h2>
                        </div>
                        <FeatureLauncher />
                    </div>
                </section>

                {/* ML Accuracy Section */}
                <section className="py-16 bg-slate-950/20 border-y border-slate-900/60 relative">
                    <div className="container mx-auto px-6">
                        <div className="flex items-center space-x-3 mb-8">
                            <Brain className="h-5 w-5 text-cyan-400" />
                            <h2 className="text-xs font-mono tracking-widest text-slate-300 uppercase">MODEL EVALUATION REPORT</h2>
                        </div>
                        <ModelAccuracyDisplay />
                    </div>
                </section>

                {/* Advanced Features Grid */}
                <section className="py-24 relative">
                    <div className="container mx-auto px-6">
                        <div className="text-center mb-20">
                            <h2 className="text-3xl md:text-5xl font-black font-outfit text-white tracking-tight mb-4">
                                CORE CONTROL SYSTEMS
                            </h2>
                            <p className="text-slate-400 max-w-2xl mx-auto text-sm font-mono uppercase tracking-wider text-cyan-400/80">
                                Integrated Neural Algorithms & Sensory Hardware Interfaces
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {features.map((feature, index) => (
                                <Link
                                    key={index}
                                    to={feature.href}
                                    className="group"
                                >
                                    <Card className="h-full glass-card border border-slate-900 hover:border-cyan-500/30 hover:scale-[1.02] transition-all duration-300 shadow-xl overflow-hidden relative">
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent translate-y-[-1.5px] group-hover:translate-y-0 transition-transform duration-300"></div>
                                        <CardHeader className="pb-4">
                                            <div className="flex items-center space-x-4 mb-3">
                                                <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.gradient} border text-white shadow-lg`}>
                                                    {feature.icon}
                                                </div>
                                                <CardTitle className="text-lg font-outfit text-slate-100 group-hover:text-cyan-400 transition-colors">
                                                    {feature.title}
                                                </CardTitle>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <CardDescription className="text-slate-400 text-sm leading-relaxed mb-4">
                                                {feature.description}
                                            </CardDescription>
                                            <div className="flex items-center text-xs font-mono text-cyan-400 group-hover:translate-x-1.5 transition-transform duration-300">
                                                <span>INITIALIZE CONTROL LINK</span>
                                                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* TESTIMONIALS SLIDER CAROUSEL */}
                <section className="py-24 bg-slate-950/30 border-t border-slate-900/60 relative">
                    <div className="container mx-auto px-6 max-w-4xl relative">
                        <div className="text-center mb-12">
                            <h2 className="text-xs font-mono tracking-widest text-cyan-400 uppercase mb-2">INDUSTRY AUDITS</h2>
                            <p className="text-xl font-bold font-outfit text-slate-200">What metallurgical leads are saying</p>
                        </div>

                        {/* Carousel Wrapper */}
                        <div className="relative glass-card p-10 rounded-2xl border border-cyan-500/25 shadow-2xl min-h-[220px] flex flex-col justify-between overflow-hidden">
                            {/* Slides */}
                            <div className="transition-all duration-500 ease-in-out">
                                <blockquote className="text-lg md:text-xl text-slate-300 font-outfit font-medium italic mb-8">
                                    "{testimonials[activeSlide].quote}"
                                </blockquote>
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center text-slate-950 font-black text-sm">
                                        {testimonials[activeSlide].author.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-100 font-outfit">{testimonials[activeSlide].author}</div>
                                        <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">{testimonials[activeSlide].role}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Manual Controls */}
                            <div className="absolute right-6 bottom-6 flex space-x-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handlePrevSlide}
                                    className="h-8 w-8 p-0 rounded-full glass-button"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleNextSlide}
                                    className="h-8 w-8 p-0 rounded-full glass-button"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Dots */}
                            <div className="absolute left-10 bottom-6 flex space-x-1.5">
                                {testimonials.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveSlide(idx)}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === activeSlide ? 'bg-cyan-400 w-5' : 'bg-slate-800 w-1.5'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* System Control Authorization CTA */}
                <section className="py-24 bg-gradient-to-br from-slate-950 to-slate-900 border-t border-slate-900 relative">
                    <div className="container mx-auto px-6 text-center">
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-4xl md:text-6xl font-black font-outfit text-white tracking-tighter mb-6">
                                READY TO RUN AI COGNITION?
                            </h2>
                            <p className="text-slate-400 max-w-2xl mx-auto mb-10 text-sm md:text-base leading-relaxed">
                                Authorize intelligent alloy optimization parameters for your furnaces. Connect spectrometer hardware configurations to instantly ingest element data.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link to="/dashboard">
                                    <Button size="lg" className="px-8 py-5 bg-white text-slate-950 font-outfit font-bold rounded-xl hover:bg-slate-200 transition-colors shadow-2xl flex items-center justify-center">
                                        <Sparkles className="h-4 w-4 mr-2 text-cyan-600" />
                                        Initialize Dashboard
                                    </Button>
                                </Link>
                                <Link to="/documentation">
                                    <Button variant="outline" size="lg" className="glass-button px-8 py-5 text-white rounded-xl flex items-center justify-center">
                                        <span>View Documentation</span>
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Index;
