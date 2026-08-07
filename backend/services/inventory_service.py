from typing import Dict, List, Any
from alloy_api.models import Inventory

class InventoryService:
    """Service to query and adjust raw material inventory stocks in PostgreSQL"""

    @staticmethod
    def get_low_stock_alerts(threshold: float = 100.0) -> List[Dict[str, Any]]:
        """Return materials whose current stock falls below threshold limits"""
        low_items = Inventory.objects.filter(current_stock__lt=threshold)
        alerts = []
        for item in low_items:
            alerts.append({
                "material_name": item.material,
                "current_stock": item.current_stock,
                "unit": item.unit,
                "status": "CRITICAL_SHORTAGE" if item.current_stock < (threshold * 0.3) else "LOW_STOCK",
                "auto_reorder_recommended": True,
                "supplier": item.supplier
            })
        return alerts

    @staticmethod
    def deduct_stock(material_name: str, quantity: float) -> bool:
        """Deduct quantity from raw material stock"""
        try:
            item = Inventory.objects.get(material=material_name)
            item.current_stock = max(0.0, item.current_stock - quantity)
            item.save()
            return True
        except Inventory.DoesNotExist:
            return False

inventory_service = InventoryService()
