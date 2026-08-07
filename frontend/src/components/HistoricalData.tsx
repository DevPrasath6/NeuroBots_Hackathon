
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Button } from '@/components/ui/button';

export const HistoricalData = () => {
  const [accuracyData, setAccuracyData] = useState<any[]>([]);
  const [additionData, setAdditionData] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      fetch('/api/charts/production-trends/').then(r => r.json()),
      fetch('/api/charts/material-usage/').then(r => r.json()),
      fetch('/api/batches/').then(r => r.json())
    ])
    .then(([trends, usage, batchesData]) => {
      setAccuracyData(trends);
      setAdditionData(usage);
      const list = batchesData.results || (Array.isArray(batchesData) ? batchesData : []);
      setBatches(list.filter((b: any) => b.status === 'COMPLETED'));
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

            {/* Table of Completed Batches */}
            <div className="mt-8 pt-8 border-t border-slate-200 col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-800 mb-4 uppercase tracking-wider font-mono">Completed Production Batches</h3>
              {batches.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-mono">No completed batches logged in database.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase pb-2">
                        <th className="pb-2">Batch ID</th>
                        <th className="pb-2">Alloy</th>
                        <th className="pb-2">Operator</th>
                        <th className="pb-2">Weight</th>
                        <th className="pb-2">Quality</th>
                        <th className="pb-2">Energy</th>
                        <th className="pb-2">Anomalies</th>
                        <th className="pb-2">Completed At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id} className="border-b border-slate-100 py-3 text-slate-700">
                          <td className="py-2.5 font-bold text-slate-900">{b.batch_code}</td>
                          <td className="py-2.5">{b.alloy_code || b.alloy_name || "316L"}</td>
                          <td className="py-2.5">{b.operator}</td>
                          <td className="py-2.5">{b.batch_weight} {b.weight_unit}</td>
                          <td className="py-2.5">
                            {b.quality_report ? (
                              <span className={b.quality_report.final_pass ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                {b.quality_report.final_pass ? "PASS" : "FAIL"} ({b.quality_report.quality_score}%)
                              </span>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="py-2.5">{b.energy_used || (b.quality_report ? b.quality_report.energy_used : "5540")} kWh</td>
                          <td className="py-2.5">
                            {b.anomalies && b.anomalies.length > 0 ? (
                              <span className="text-amber-600 font-bold">{b.anomalies.length}</span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="py-2.5">{new Date(b.actual_completion || b.creation_time).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
