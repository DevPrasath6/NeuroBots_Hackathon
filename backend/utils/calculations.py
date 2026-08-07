from typing import Dict, Tuple
from utils.constants import ALLOY_MATERIALS

def calculate_material_required(element: str, deviation_pct: float, heat_size_tons: float) -> Tuple[str, float]:
    """
    Calculate which raw material from PostgreSQL is needed and the exact mass (kg)
    """
    if deviation_pct <= 0:
        return "", 0.0

    from alloy_api.models import AlloyRawMaterial
    raw_materials = list(AlloyRawMaterial.objects.all())

    # Find candidate material that contains the element
    el = element.lower()
    material = None
    if el == 'fe':
        material = next((r for r in raw_materials if 'scrap' in r.material_name.lower() or 'iron' in r.material_name.lower()), None)
    elif el == 'cr':
        material = next((r for r in raw_materials if 'chrome' in r.material_name.lower() or 'chromium' in r.material_name.lower()), None)
    elif el == 'ni':
        material = next((r for r in raw_materials if 'nickel' in r.material_name.lower() or 'ni ' in r.material_name.lower() or 'ni-' in r.material_name.lower()), None)
    elif el == 'mn':
        material = next((r for r in raw_materials if 'manganese' in r.material_name.lower() or 'mn' in r.material_name.lower()), None)
    elif el == 'si':
        material = next((r for r in raw_materials if 'silicon' in r.material_name.lower() or 'si' in r.material_name.lower()), None)
    elif el == 'mo':
        material = next((r for r in raw_materials if 'molybdenum' in r.material_name.lower() or 'moly' in r.material_name.lower()), None)
    elif el == 'c':
        material = next((r for r in raw_materials if 'carbon' in r.material_name.lower() or 'graphite' in r.material_name.lower()), None)
    
    if not material:
        # Fallback by substring
        for r in raw_materials:
            if el in r.material_name.lower():
                material = r
                break

    if not material:
        return "", 0.0

    purity_factor = material.purity / 100.0
    recovery_factor = material.estimated_recovery / 100.0
    
    element_mass = (deviation_pct / 100.0) * (heat_size_tons * 1000.0)
    quantity_kg = element_mass / (purity_factor * recovery_factor) if purity_factor * recovery_factor > 0 else 0.0
    return material.material_name, round(max(0.0, quantity_kg), 2)

def estimate_liquidus_temp(composition: Dict[str, float]) -> float:
    """Estimate Liquidus melting point (°C) using metallurgical carbon equivalents"""
    # Base melting point of pure iron is 1538 °C
    base_temp = 1538.0
    carbon = composition.get('C', 0.0)
    silicon = composition.get('Si', 0.0)
    manganese = composition.get('Mn', 0.0)
    chromium = composition.get('Cr', 0.0)
    nickel = composition.get('Ni', 0.0)
    
    # Standard thermodynamic liquidus depression equations
    depression = (carbon * 80.0) + (silicon * 8.0) + (manganese * 5.0) + (chromium * 1.5) + (nickel * 4.0)
    return max(1300.0, base_temp - depression)
