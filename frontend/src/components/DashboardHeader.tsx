import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Bell, 
  User, 
  Activity, 
  Zap, 
  Shield,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { SettingsDialog } from './SettingsDialog';
import { dataService } from '@/services/dataService';
import { Link } from 'react-router-dom';
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger } from '@/components/ui/navigation-menu';

export const DashboardHeader = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [systemStatus, setSystemStatus] = useState({
    isOnline: true,
    uptime: '47.2h',
    efficiency: 87.5
  });

  useEffect(() => {
    const fetchAlerts = async () => {
      const alerts = await dataService.getActiveAlerts();
      setActiveAlerts(alerts.length);
    };
    
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="glass-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo, Title and Navigation */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-900 shadow-[0_0_15px_rgba(0,243,255,0.35)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                  <Zap className="h-5 w-5 fill-slate-900 text-slate-900" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold font-outfit tracking-tight text-gradient">
                    Alloy Alchemy Advisor
                  </h1>
                  <p className="text-xs font-mono text-cyan-400/80 uppercase tracking-widest">
                    AI Metallurgical Intelligence
                  </p>
                </div>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:block">
                <NavigationMenu>
                  <NavigationMenuList>
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className="glass-button bg-transparent border-0 hover:bg-slate-900/40 text-slate-300 font-outfit font-medium">
                        Control Center Menu
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid gap-2 p-4 md:w-[600px] lg:w-[800px] grid-cols-2 bg-slate-950/95 border border-cyan-500/20 backdrop-blur-xl rounded-xl shadow-2xl">
                          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Dashboard Panel</span>
                          </Link>
                          <Link to="/recommendations" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>AI Recommendations</span>
                          </Link>
                          <Link to="/analytics" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Model Analytics</span>
                          </Link>
                          <Link to="/alerts" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Operator Alerts</span>
                          </Link>
                          <Link to="/inventory" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Raw Materials Inventory</span>
                          </Link>
                          <Link to="/predictive" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Predictive Maintenance</span>
                          </Link>
                          <Link to="/furnace" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Furnace Telemetry</span>
                          </Link>
                          <Link to="/anomaly" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Anomaly Detection</span>
                          </Link>
                          <Link to="/quality" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Quality Assurance</span>
                          </Link>
                          <Link to="/history" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Additions History</span>
                          </Link>
                          <Link to="/documentation" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>System Documentation</span>
                          </Link>
                          <Link to="/features" className="text-sm text-slate-300 hover:text-cyan-400 px-3 py-2 rounded-lg hover:bg-slate-900/60 transition-colors font-outfit flex items-center space-x-2">
                            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
                            <span>Feature Grid</span>
                          </Link>
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  </NavigationMenuList>
                </NavigationMenu>
              </nav>
            </div>

            {/* System Status */}
            <div className="hidden md:flex items-center space-x-6">
              <div className="flex items-center space-x-2 border border-slate-800 bg-slate-950/60 px-3 py-1.5 rounded-full">
                <div className={`w-2 h-2 rounded-full ${systemStatus.isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs font-mono font-medium text-slate-300">
                  {systemStatus.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              
              <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>UPTIME: {systemStatus.uptime}</span>
              </div>
              
              <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span>EFFICIENCY: {systemStatus.efficiency}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              {/* Alerts */}
              <Button
                variant="outline"
                size="sm"
                className="relative glass-button px-3"
              >
                <Bell className="h-4 w-4" />
                {activeAlerts > 0 && (
                  <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center p-0 animate-pulse">
                    {activeAlerts}
                  </Badge>
                )}
              </Button>

              {/* Settings */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                className="glass-button"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>

              {/* Admin (opens Django Admin) */}
              <a
                href="http://localhost:8000/admin/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="glass-button"
                >
                  <User className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </a>

              {/* Security Status */}
              <div className="flex items-center space-x-2 px-3 py-1 bg-green-950/40 border border-green-500/30 text-green-400 rounded-md font-mono text-xs shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                <Shield className="h-3.5 w-3.5 text-green-400 animate-pulse" />
                <span>SECURE</span>
              </div>
            </div>
          </div>

          {/* Mobile System Status */}
          <div className="md:hidden mt-3 flex items-center justify-between text-xs font-mono text-slate-400 border-t border-slate-800/60 pt-3">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${systemStatus.isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-slate-300">{systemStatus.isOnline ? 'ONLINE' : 'OFFLINE'}</span>
              </div>
              <span className="text-slate-400">UPTIME: {systemStatus.uptime}</span>
              <span className="text-slate-400">⚡ {systemStatus.efficiency}%</span>
            </div>
            
            {activeAlerts > 0 && (
              <div className="flex items-center space-x-1 text-orange-500">
                <AlertCircle className="h-4 w-4 animate-bounce" />
                <span>{activeAlerts} ALERT{activeAlerts !== 1 ? 'S' : ''}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};
