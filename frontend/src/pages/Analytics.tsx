
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardHeader } from '@/components/DashboardHeader';
import { ProcessAnalytics } from '@/components/ProcessAnalytics';
import { HistoricalData } from '@/components/HistoricalData';
import { NeuralNetworkVisualizer } from '@/components/NeuralNetworkVisualizer';
import { LiveMetricsGlobe } from '@/components/LiveMetricsGlobe';

const Analytics = () => {
  return (
    <div className="min-h-screen bg-transparent text-slate-100">
      <DashboardHeader />
      
      <div className="relative container mx-auto px-6 py-6">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button className="glass-button shadow-[0_4px_12px_rgba(0,0,0,0.3)] flex items-center">
              <ArrowLeft className="h-4 w-4 mr-2 text-cyan-400" />
              Back to Home
            </Button>
          </Link>
          
          <div className="bg-slate-950/40 border border-slate-800 px-4 py-2 rounded-full flex items-center space-x-2 shadow-[0_0_15px_rgba(0,243,255,0.05)]">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">ANALYTICS CONSOLE</span>
            <Sparkles className="h-4 w-4 text-orange-400 animate-pulse" />
          </div>
        </div>

        {/* All Analytics Features Vertically Aligned */}
        <div className="space-y-8">
          <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
            <NeuralNetworkVisualizer />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <LiveMetricsGlobe />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <ProcessAnalytics />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '600ms' }}>
            <HistoricalData />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
