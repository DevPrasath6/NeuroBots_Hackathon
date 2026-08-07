import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  resolved?: boolean;
}

export const AlertPanel = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadAlerts = async () => {
    try {
      const res = await fetch('/api/anomalies/');
      if (res.ok) {
        const data = await res.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        const mapped = results.map((item: any) => ({
          id: item.id,
          type: item.severity === 'critical' || item.severity === 'high' ? 'critical' : item.severity === 'medium' ? 'warning' : 'info',
          title: item.type || 'Anomaly Detected',
          message: item.description,
          timestamp: new Date(item.timestamp),
          resolved: item.resolved
        }));
        setAlerts(mapped);
      }
    } catch (e) {
      console.error("Failed to load anomalies in AlertPanel:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 8000);
    return () => clearInterval(interval);
  }, []);


  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getAlertBadgeColor = (type: string) => {
    switch (type) {
      case 'critical': return 'bg-red-500 text-white';
      case 'warning': return 'bg-orange-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <Card className="bg-white border-slate-200 shadow-elegant">
      <CardHeader>
        <CardTitle className="text-xl text-slate-800 flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
          System Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div 
              key={alert.id} 
              className={`p-3 rounded-lg border-l-4 bg-slate-50 ${
                alert.type === 'critical' ? 'border-red-500' :
                alert.type === 'warning' ? 'border-orange-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getAlertIcon(alert.type)}
                  <span className="font-medium text-slate-800 text-sm">{alert.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {alert.resolved && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <Badge className={getAlertBadgeColor(alert.type)}>
                    {alert.type.toUpperCase()}
                  </Badge>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 mb-2">{alert.message}</p>
              
              <div className="text-xs text-slate-500">
                {alert.timestamp.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
