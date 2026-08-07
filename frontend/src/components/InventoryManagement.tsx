
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Package, AlertCircle, TrendingDown, TrendingUp, Plus, Minus } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  minThreshold: number;
  maxCapacity: number;
  unit: string;
  costPerUnit: number;
  lastRestocked: Date;
  supplier: string;
  usage24h: number;
  estimatedDaysLeft: number;
}

export const InventoryManagement = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadInventory = async () => {
    try {
      const res = await fetch('/api/inventory/');
      if (res.ok) {
        const data = await res.json();
        const results = data.results || (Array.isArray(data) ? data : []);
        const mapped = results.map((item: any) => ({
          id: item.id,
          name: item.material_name,
          currentStock: item.quantity,
          minThreshold: item.minimum_stock || 100,
          maxCapacity: item.maximum_stock || 1000,
          unit: item.unit || "kg",
          costPerUnit: item.cost || 5.0,
          lastRestocked: new Date(item.last_updated),
          supplier: item.supplier || "Vendor",
          usage24h: 12.5,
          estimatedDaysLeft: Math.round(item.quantity / 12.5) || 10
        }));
        setInventory(mapped);
      }
    } catch (e) {
      console.error("Failed to load inventory from PostgreSQL:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleQuantityAdjust = async (id: string, currentVal: number, amount: number) => {
    try {
      const newVal = Math.max(0, currentVal + amount);
      const res = await fetch(`/api/inventory/${id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_stock: newVal })
      });
      if (res.ok) {
        loadInventory();
      }
    } catch (e) {
      console.error("Failed to adjust quantity in PostgreSQL:", e);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.maxCapacity) * 100;
    if (item.currentStock <= item.minThreshold) return 'critical';
    if (percentage <= 30) return 'low';
    if (percentage >= 80) return 'high';
    return 'normal';
  };

  const getStatusBadgeVariant = (status: string): 'destructive' | 'secondary' | 'default' => {
    switch (status) {
      case 'critical':
        return 'destructive';
      case 'low':
        return 'secondary';
      case 'high':
      default:
        return 'default';
    }
  };

  const totalInventoryValue = inventory.reduce((sum, item) =>
    sum + (item.currentStock * item.costPerUnit), 0
  );

  const criticalItems = inventory.filter(item => getStockStatus(item) === 'critical').length;
  const lowStockItems = inventory.filter(item => getStockStatus(item) === 'low').length;

  if (isLoading) {
    return <div className="text-center py-16 text-slate-500 text-sm font-mono">Querying PostgreSQL inventory catalog...</div>;
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-xl text-foreground flex items-center">
          <Package className="h-5 w-5 mr-2 text-primary" />
          Inventory Management System
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Value</p>
                  <p className="text-foreground text-xl font-bold">${totalInventoryValue.toFixed(2)}</p>
                </div>
                <Package className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Critical Items</p>
                  <p className="text-destructive text-xl font-bold">{criticalItems}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Low Stock</p>
                  <p className="text-foreground text-xl font-bold">{lowStockItems}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-primary" />
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Items</p>
                  <p className="text-foreground text-xl font-bold">{inventory.length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>

          {/* Inventory Items */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Current Stock Levels</h3>
            {inventory.map((item) => {
              const status = getStockStatus(item);
              const stockPercentage = (item.currentStock / item.maxCapacity) * 100;
              
              return (
                <div key={item.id} className="bg-muted rounded-lg p-4 animate-fade-in">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <h4 className="font-semibold text-foreground">{item.name}</h4>
                        <Badge variant={getStatusBadgeVariant(status)}>
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Stock:</span>
                          <div className="text-foreground font-mono text-lg">
                            {item.currentStock} {item.unit}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Min Threshold:</span>
                          <div className="text-foreground font-mono">
                            {item.minThreshold} {item.unit}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Days Left:</span>
                          <div className="text-foreground font-mono">
                            ~{item.estimatedDaysLeft} days
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cost/Unit:</span>
                          <div className="text-foreground font-mono">
                            ${item.costPerUnit}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleQuantityAdjust(item.id, item.currentStock, -50)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleQuantityAdjust(item.id, item.currentStock, 50)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Stock Level</span>
                      <span className="text-foreground">{stockPercentage.toFixed(1)}% of capacity</span>
                    </div>
                    <Progress value={stockPercentage} className="h-2" />
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0 {item.unit}</span>
                      <span>{item.maxCapacity} {item.unit}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center text-sm">
                      <div className="space-x-4">
                        <span className="text-muted-foreground">
                          Supplier: <span className="text-foreground">{item.supplier}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Usage (24h): <span className="text-foreground">{item.usage24h} {item.unit}</span>
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        Last restocked: {item.lastRestocked.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
