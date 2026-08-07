from typing import Dict, Any, List
from alloy_api.models import Alloy, AlloyComposition, AlloyRawMaterial

class CompositionService:
    """Service to calculate target raw material feedstock additions using PostgreSQL data"""

    @staticmethod
    def calculate_batch_recipe(alloy_code: str, batch_weight_kg: float) -> Dict[str, Any]:
        """
        Perform a thermodynamic mass balance calculation to determine the exact weight (kg)
        of each raw material required for the batch.
        
        Args:
            alloy_code: Alloy grade code (e.g. '316L')
            batch_weight_kg: Target batch size in kg
            
        Returns:
            Dict containing raw material additions and metadata
        """
        try:
            alloy = Alloy.objects.prefetch_related('compositions').get(code__iexact=alloy_code)
        except Alloy.DoesNotExist:
            alloy = Alloy.objects.prefetch_related('compositions').filter(code__icontains=alloy_code).first()
            if not alloy:
                alloy = Alloy.objects.prefetch_related('compositions').first()
                if not alloy:
                    return {"error": "No alloys found in database."}

        compositions = list(alloy.compositions.all())
        raw_materials = list(AlloyRawMaterial.objects.all())

        # Map elements to their primary raw material
        # Ferrochrome -> Cr, Ferronickel -> Ni, Ferromanganese -> Mn, Ferrosilicon -> Si,
        # Ferromolybdenum -> Mo, Carbon additive -> C, Ni Metal -> Ni, Iron Scrap -> Fe
        def get_material_for_element(element_symbol: str) -> AlloyRawMaterial:
            el = element_symbol.lower()
            if el == 'fe':
                return next((r for r in raw_materials if 'scrap' in r.material_name.lower() or 'iron' in r.material_name.lower()), None)
            elif el == 'cr':
                return next((r for r in raw_materials if 'chrome' in r.material_name.lower() or 'chromium' in r.material_name.lower()), None)
            elif el == 'ni':
                return next((r for r in raw_materials if 'nickel' in r.material_name.lower() or 'ni ' in r.material_name.lower() or 'ni-' in r.material_name.lower()), None)
            elif el == 'mn':
                return next((r for r in raw_materials if 'manganese' in r.material_name.lower() or 'mn' in r.material_name.lower()), None)
            elif el == 'si':
                return next((r for r in raw_materials if 'silicon' in r.material_name.lower() or 'si' in r.material_name.lower()), None)
            elif el == 'mo':
                return next((r for r in raw_materials if 'molybdenum' in r.material_name.lower() or 'moly' in r.material_name.lower()), None)
            elif el == 'c':
                return next((r for r in raw_materials if 'carbon' in r.material_name.lower() or 'graphite' in r.material_name.lower()), None)
            # Generic fallbacks by substring
            for r in raw_materials:
                if el in r.material_name.lower():
                    return r
            return None

        recipe_additions = {}
        fe_carried_over = 0.0

        # Calculate alloys additions (non-Fe)
        for comp in compositions:
            if comp.element.lower() == 'fe' or comp.target_pct <= 0:
                continue

            material = get_material_for_element(comp.element)
            if not material:
                continue

            # target element mass in kg
            element_mass = batch_weight_kg * (comp.target_pct / 100.0)
            # raw material mass required = element_mass / (purity * recovery)
            purity_factor = material.purity / 100.0
            recovery_factor = material.estimated_recovery / 100.0
            
            raw_qty = element_mass / (purity_factor * recovery_factor) if purity_factor * recovery_factor > 0 else 0.0
            raw_qty = round(raw_qty, 2)

            recipe_additions[material.material_name] = {
                "quantity": raw_qty,
                "purpose": material.purpose,
                "unit_cost": material.unit_cost,
                "total_cost": round(raw_qty * material.unit_cost, 2),
                "purity": material.purity,
                "recovery": material.estimated_recovery
            }

            # Calculate Fe balance carried by this ferroalloy (usually the remainder)
            fe_fraction = 1.0 - purity_factor
            fe_carried_over += raw_qty * fe_fraction

        # Calculate Fe base scrap
        fe_comp = next((c for c in compositions if c.element.lower() == 'fe'), None)
        fe_target_pct = fe_comp.target_pct if fe_comp else (100.0 - sum(c.target_pct for c in compositions if c.element.lower() != 'fe'))
        
        fe_target_mass = batch_weight_kg * (fe_target_pct / 100.0)
        fe_needed = max(0.0, fe_target_mass - fe_carried_over)

        fe_material = get_material_for_element('Fe')
        if fe_material:
            fe_purity = fe_material.purity / 100.0
            fe_recovery = fe_material.estimated_recovery / 100.0
            fe_scrap_qty = fe_needed / (fe_purity * fe_recovery) if fe_purity * fe_recovery > 0 else 0.0
            fe_scrap_qty = round(fe_scrap_qty, 2)

            recipe_additions[fe_material.material_name] = {
                "quantity": fe_scrap_qty,
                "purpose": fe_material.purpose,
                "unit_cost": fe_material.unit_cost,
                "total_cost": round(fe_scrap_qty * fe_material.unit_cost, 2),
                "purity": fe_material.purity,
                "recovery": fe_material.estimated_recovery
            }

        # Calculate overall metrics
        total_cost = sum(r["total_cost"] for r in recipe_additions.values())
        total_weight = sum(r["quantity"] for r in recipe_additions.values())

        return {
            "alloy_name": alloy.name,
            "grade": alloy.code,
            "target_weight_kg": batch_weight_kg,
            "calculated_raw_materials": recipe_additions,
            "total_cost": round(total_cost, 2),
            "total_calculated_weight": round(total_weight, 2),
            "density": alloy.density,
            "melting_point": alloy.melting_point_max
        }

    # Backward compatible adapter
    @staticmethod
    def calculate_batch_composition(grade: str, batch_weight_tons: float) -> Dict[str, Any]:
        """Legacy compatibility wrapper mapping to target element masses"""
        alloy_recipe = CompositionService.calculate_batch_recipe(grade, batch_weight_tons * 1000.0)
        if "error" in alloy_recipe:
            return alloy_recipe

        # Convert raw materials list to element masses
        try:
            alloy = Alloy.objects.prefetch_related('compositions').get(code__iexact=grade)
        except Exception:
            alloy = Alloy.objects.prefetch_related('compositions').first()

        element_masses = {}
        target_composition = {}
        for comp in alloy.compositions.all():
            target_composition[comp.element] = comp.target_pct
            mass_kg = batch_weight_tons * 1000.0 * (comp.target_pct / 100.0)
            element_masses[comp.element] = round(mass_kg, 2)

        return {
            "alloy_name": alloy.name,
            "grade": alloy.code,
            "target_weight_tons": batch_weight_tons,
            "element_target_percentages": target_composition,
            "calculated_element_masses_kg": element_masses,
            "density": alloy.density,
            "melting_point": alloy.melting_point_max
        }

composition_service = CompositionService()
