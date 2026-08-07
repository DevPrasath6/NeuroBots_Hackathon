
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button } from '@/components/ui/button';

export const HistoricalData = () => {
  const [accuracyData, setAccuracyData] = useState<any[]>([]);
  const [additionData, setAdditionData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      fetch('/api/charts/production-trends/').then(r => r.json()),
      fetch('/api/charts/material-usage/').then(r => r.json())
    ])
    .then(([trends, usage]) => {
      setAccuracyData(trends);
      setAdditionData(usage);
      setIsLoading(false);
    })
    .catch(err => {
      console.error("Error fetching historical charts:", err);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <Card className="bg-white border-slate-200 shadow-elegant">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl text-slate-800 flex items-center">
          <Database className="h-5 w-5 mr-2 text-slate-600" />
          Historical Performance
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="text-slate-500 hover:text-slate-900"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-16 text-slate-500 text-sm font-mono">
            Ingesting historical production logs...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-4">Model Accuracy (24h)</h3>
              {accuracyData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No records available</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={accuracyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} domain={[90, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        color: '#1e293b'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#475569" 
                      strokeWidth={2}
                      dot={{ fill: '#475569', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-800 mb-4">Alloy Addition Success Rate</h3>
              {additionData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No records available</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={additionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="alloy" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#ffffff', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        color: '#1e293b'
                      }}
                    />
                    <Bar dataKey="success" fill="#475569" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="count" fill="#94a3af" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
