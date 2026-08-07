import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getModelAccuracy, ModelAccuracy } from '@/services/modelAccuracy';

interface ModelRegistryItem {
    id: string;
    model_name: string;
    algorithm: string;
    version: string;
    accuracy: number;
    dataset_size: number;
    trained_date: string;
}

export const ModelAccuracyDisplay = () => {
    const [accuracy, setAccuracy] = useState<ModelAccuracy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [registryItems, setRegistryItems] = useState<ModelRegistryItem[]>([]);
    const [registryLoading, setRegistryLoading] = useState(true);

    const loadAccuracy = async () => {
        setIsLoading(true);
        try {
            const data = await getModelAccuracy();
            setAccuracy(data);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to load model accuracy:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadRegistry = () => {
        setRegistryLoading(true);
        fetch('/api/model-registry/')
            .then(res => res.json())
            .then(data => {
                setRegistryItems(data.results || (Array.isArray(data) ? data : []));
                setRegistryLoading(false);
            })
            .catch(err => {
                console.error("Error loading model registry:", err);
                setRegistryItems([]);
                setRegistryLoading(false);
            });
    };

    useEffect(() => {
        loadAccuracy();
        loadRegistry();
        const interval = setInterval(loadAccuracy, 30000);
        return () => clearInterval(interval);
    }, []);

    const getAccuracyBadge = (val: number) => {
        if (val >= 98) return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Optimal</Badge>;
        if (val >= 90) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Stable</Badge>;
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Standard</Badge>;
    };

    if (isLoading || !accuracy) {
        return (
            <Card className="bg-card border-border shadow-elegant">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <span>Model Accuracy</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <div className="animate-spin">
                            <RefreshCw className="h-6 w-6 text-primary mx-auto" />
                        </div>
                        <p className="text-muted-foreground mt-2">Loading model accuracy...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-card border-border shadow-elegant">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5 text-primary" />
                        <span>Model Performance Metrics</span>
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { loadAccuracy(); loadRegistry(); }}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Version {accuracy.modelVersion} • Checked: {new Date(accuracy.trainedAt).toLocaleDateString()}
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Accuracy Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Material Classifier */}
                    <div className="bg-subtle border border-subtle rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Material Classifier</span>
                            {getAccuracyBadge(accuracy.materialClassifierAccuracy)}
                        </div>
                        <div className="space-y-2">
                            <div className="text-3xl font-bold text-foreground">
                                {accuracy.materialClassifierAccuracy.toFixed(2)}%
                            </div>
                            <Progress value={accuracy.materialClassifierAccuracy} className="h-2" />
                        </div>
                        <p className="text-xs text-muted-foreground">Classification Boundary Model</p>
                    </div>

                    {/* Quantity Regressor */}
                    <div className="bg-subtle border border-subtle rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Quantity Regressor (R²)</span>
                            {getAccuracyBadge(accuracy.quantityRegressorR2)}
                        </div>
                        <div className="space-y-2">
                            <div className="text-3xl font-bold text-foreground">
                                {accuracy.quantityRegressorR2.toFixed(2)}%
                            </div>
                            <Progress value={accuracy.quantityRegressorR2} className="h-2" />
                        </div>
                        <p className="text-xs text-muted-foreground">Energy Consumption Estimation</p>
                    </div>

                    {/* Quality Predictor */}
                    <div className="bg-subtle border border-subtle rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Quality Predictor (R²)</span>
                            {getAccuracyBadge(accuracy.qualityPredictorR2)}
                        </div>
                        <div className="space-y-2">
                            <div className="text-3xl font-bold text-foreground">
                                {accuracy.qualityPredictorR2.toFixed(2)}%
                            </div>
                            <Progress value={accuracy.qualityPredictorR2} className="h-2" />
                        </div>
                        <p className="text-xs text-muted-foreground">Alloy Standard Compliance</p>
                    </div>
                </div>

                {/* Additional Metrics */}
                <div className="border-t border-border pt-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Quantity MAE</div>
                            <div className="text-2xl font-bold text-foreground">
                                {accuracy.quantityMAE.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">kg (mean error)</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Average Accuracy</div>
                            <div className="text-2xl font-bold text-foreground">
                                {accuracy.averageAccuracy.toFixed(2)}%
                            </div>
                            <div className="text-xs text-muted-foreground">overall</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Status</div>
                            <div className="text-2xl font-bold text-green-600">✓</div>
                            <div className="text-xs text-muted-foreground">{accuracy.modelStatus.toLowerCase()}</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                            <div className="text-xs text-foreground font-semibold">
                                {lastUpdated?.toLocaleTimeString() || 'now'}
                            </div>
                            <div className="text-xs text-muted-foreground">just now</div>
                        </div>
                    </div>
                </div>

                {/* Algorithm Details */}
                <div className="border-t border-border pt-6">
                    <h4 className="font-semibold text-foreground mb-3 flex items-center">
                        <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                        Algorithm Breakdown
                    </h4>
                    <div className="space-y-2 text-sm">
                        {registryLoading ? (
                            <div className="text-muted-foreground text-xs">Loading algorithms...</div>
                        ) : registryItems.length === 0 ? (
                            <div className="text-red-500 text-xs">Model not trained / Data unavailable</div>
                        ) : (
                            registryItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2 bg-subtle rounded">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-foreground">{item.algorithm}</span>
                                        <span className="text-xs text-muted-foreground">{item.model_name} (v{item.version})</span>
                                    </div>
                                    <Badge variant="secondary">Acc: ${(item.accuracy <= 1.0 ? item.accuracy * 100.0 : item.accuracy).toFixed(2)}%</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
