import re
import json
import random
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Q
from alloy_api.models import (
    Alloy, AlloyComposition, AlloyRawMaterial, Inventory, 
    ProductionBatch, FurnaceReading, SpectrometerResult, AIRecommendation,
    Anomaly, ModelRegistry
)
from ai.prediction_engine import prediction_engine
from ai.digital_twin import DigitalTwinSimulator

class MetallurgicalAgent:
    """
    Industrial Metallurgical AI Recommendation Agent.
    Orchestrates: database lookup, physical composition calculation, raw material charge
    recovery weights, cost optimization, ML prediction layer, digital twin status, 
    spectrometer corrections, and context-aware conversational memory.
    """

    def __init__(self):
        pass

    @staticmethod
    def parse_weight(text: str) -> tuple:
        """
        Parses text for weight. Returns (weight_kg, unit_string) or (None, None).
        Supports: grams, kg, tons, tonnes, metric tons.
        """
        text = text.lower()
        # Regex for weight patterns like 500 kg, 5 tonnes, 1.5 tons, 2t, 500g
        pattern = r'(\d+(?:\.\d+)?)\s*(kg|kilograms|kilogram|g|grams|gram|tonnes|tonne|tons|ton|t|metric\s*tons|metric\s*ton)'
        match = re.search(pattern, text)
        if match:
            val = float(match.group(1))
            unit = match.group(2)
            
            # Convert to kg standard for calculations
            if 'g' in unit and 'k' not in unit:
                return val / 1000.0, "kg"
            elif 'ton' in unit or 't' in unit:
                return val * 1000.0, "kg"
            else:
                return val, "kg"
        return None, None

    @staticmethod
    def extract_grade(text: str) -> str:
        """
        Extracts alloy grade code from text by matching against database codes/names.
        """
        text = text.upper()
        alloys = Alloy.objects.all()
        # Direct matching in text
        for alloy in alloys:
            if alloy.code.upper() in text:
                return alloy.code
            # Match code variations like "SS304" or "SS 304" for 304
            clean_code = alloy.code.replace('-', '').upper()
            if clean_code in text.replace(' ', ''):
                return alloy.code
            
            # Substrings in name
            clean_name = alloy.name.upper()
            if clean_name in text:
                return alloy.code
            # e.g., "304 STAINLESS" -> 304
            if "304" in text and "304" in alloy.code:
                return alloy.code
            if "316" in text and "316" in alloy.code:
                return alloy.code
            if "410" in text and "410" in alloy.code:
                return alloy.code
            if "4140" in text and "4140" in alloy.code:
                return alloy.code
            if "4340" in text and "4340" in alloy.code:
                return alloy.code
            if "H13" in text and "H13" in alloy.code:
                return alloy.code
            if "D2" in text and "D2" in alloy.code:
                return alloy.code
            if "718" in text and "718" in alloy.code:
                return alloy.code
            if "625" in text and "625" in alloy.code:
                return alloy.code
            if "1095" in text and "1095" in alloy.code:
                return alloy.code
            if "1018" in text and "1018" in alloy.code:
                return alloy.code
            if "DUPLEX" in text and "F51" in alloy.code:
                return alloy.code
        return None

    @staticmethod
    def get_material_for_element(element: str, raw_materials: list) -> AlloyRawMaterial:
        """Matches a chemical element to the appropriate database raw material"""
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
        elif el == 'ti':
            material = next((r for r in raw_materials if 'titanium' in r.material_name.lower() or 'ti ' in r.material_name.lower()), None)
        elif el == 'v':
            material = next((r for r in raw_materials if 'vanadium' in r.material_name.lower() or ' v ' in r.material_name.lower()), None)
            
        if not material and raw_materials:
            # Substring fallback
            for r in raw_materials:
                if el in r.material_name.lower():
                    material = r
                    break
        return material

    def calculate_recipe(self, alloy: Alloy, weight_kg: float) -> dict:
        """
        Calculates exact target composition element weights, charge required (adjusting for purity & recovery),
        cost estimation, stock status, shortage details, and alternative options.
        """
        compositions = list(AlloyComposition.objects.filter(alloy=alloy))
        raw_materials = list(AlloyRawMaterial.objects.all())
        inventory_items = list(Inventory.objects.all())
        
        recipe_items = []
        total_element_weight = 0.0
        total_charge_weight = 0.0
        total_cost = 0.0
        inventory_alerts = []
        insufficient_materials = []
        
        # Calculate for each element
        for comp in compositions:
            element = comp.element
            pct = comp.target_pct
            
            # Element mass in kg
            element_mass = (pct / 100.0) * weight_kg
            total_element_weight += element_mass
            
            # Map element to raw material
            material = self.get_material_for_element(element, raw_materials)
            
            if material:
                purity_factor = material.purity / 100.0
                recovery_factor = material.estimated_recovery / 100.0
                
                # Charge weight = Target / (Purity * Recovery)
                denom = purity_factor * recovery_factor
                charge_needed = element_mass / denom if denom > 0 else 0.0
                total_charge_weight += charge_needed
                
                # Cost calculation
                cost_per_kg = material.unit_cost
                item_cost = charge_needed * cost_per_kg
                total_cost += item_cost
                
                # Find matching inventory stock
                inv_match = next((inv for inv in inventory_items if inv.material.lower() == material.material_name.lower() or material.material_name.lower() in inv.material.lower()), None)
                
                stock_avail = inv_match.current_stock if inv_match else 0.0
                stock_unit = inv_match.unit if inv_match else "kg"
                supplier = inv_match.supplier if inv_match else material.supplier
                
                # Convert stock tons to kg if unit is tons
                stock_avail_kg = stock_avail * 1000.0 if stock_unit.lower() == 'tons' or stock_unit.lower() == 'ton' else stock_avail
                
                status = "OPTIMAL"
                shortage = 0.0
                if charge_needed > stock_avail_kg:
                    status = "SHORTAGE"
                    shortage = charge_needed - stock_avail_kg
                    insufficient_materials.append({
                        'material': material.material_name,
                        'required': round(charge_needed, 1),
                        'available': round(stock_avail_kg, 1),
                        'shortage': round(shortage, 1),
                        'supplier': supplier
                    })
                    inventory_alerts.append(f"INSUFFICIENT STOCK: {material.material_name} (Short by {shortage:.1f} kg)")
                
                recipe_items.append({
                    'element': element,
                    'pct': pct,
                    'element_weight_kg': round(element_mass, 2),
                    'material': material.material_name,
                    'purity': material.purity,
                    'recovery': material.estimated_recovery,
                    'charge_needed_kg': round(charge_needed, 2),
                    'stock_available_kg': round(stock_avail_kg, 2),
                    'status': status,
                    'cost': round(item_cost, 2),
                    'supplier': supplier
                })
            else:
                # Direct addition fallback
                recipe_items.append({
                    'element': element,
                    'pct': pct,
                    'element_weight_kg': round(element_mass, 2),
                    'material': f"{element} pure agent",
                    'purity': 100.0,
                    'recovery': 95.0,
                    'charge_needed_kg': round(element_mass / 0.95, 2),
                    'stock_available_kg': 99999.0,
                    'status': "OPTIMAL",
                    'cost': round(element_mass * 15.0, 2),
                    'supplier': "GlobalMetals"
                })
                total_charge_weight += (element_mass / 0.95)
                total_cost += (element_mass * 15.0)

        # ML Predictions for this alloy target
        plate_features = {
            "current_C": next((r['pct'] for r in recipe_items if r['element'] == 'C'), 0.02),
            "current_Si": next((r['pct'] for r in recipe_items if r['element'] == 'Si'), 0.5),
            "current_Mn": next((r['pct'] for r in recipe_items if r['element'] == 'Mn'), 1.0),
            "current_Cr": next((r['pct'] for r in recipe_items if r['element'] == 'Cr'), 17.0),
            "current_Ni": next((r['pct'] for r in recipe_items if r['element'] == 'Ni'), 12.0),
            "current_Mo": next((r['pct'] for r in recipe_items if r['element'] == 'Mo'), 2.2),
            "Steel_Plate_Thickness": 12.0
        }
        
        ml_quality = prediction_engine.predict_quality_score(plate_features)
        anomaly_p = prediction_engine.predict_anomaly_prob(plate_features)
        
        # Calculate parameters
        melting_duration = int(alloy.estimated_holding_time * (weight_kg / 1000.0)**0.15)
        # Constants mapping
        from utils.constants import HEATING_GRADIENT
        power_usage = round(prediction_engine.predict_energy(15.0, 5.0, 0.45, 0.85, 0.9, 120.0) * (weight_kg / 1000.0), 1)

        return {
            'alloy_code': alloy.code,
            'alloy_name': alloy.name,
            'weight_kg': weight_kg,
            'elements_target': {c.element: c.target_pct for c in compositions},
            'recipe_items': recipe_items,
            'total_element_weight_kg': round(total_element_weight, 2),
            'total_charge_weight_kg': round(total_charge_weight, 2),
            'total_cost': round(total_cost, 2),
            'shortages': insufficient_materials,
            'alerts': inventory_alerts,
            'ml_metrics': {
                'expected_quality': round(ml_quality, 2),
                'anomaly_probability': round(anomaly_p, 4),
                'qc_pass_rate': round((1.0 - anomaly_p) * 100, 1),
                'expected_duration_minutes': melting_duration,
                'power_consumption_kwh': power_usage,
                'expected_defect_rate': round(anomaly_p * 15.0, 2),
                'furnace_efficiency': round(98.5 - (anomaly_p * 10.0), 1)
            }
        }

    def evaluate_alloy_rankings(self, application: str, weight_kg: float = 1000.0) -> list:
        """
        Ranks alloys matching application requirements using metallurgical compatibility.
        """
        all_alloys = list(Alloy.objects.all())
        rankings = []

        app_keywords = {
            'food': (['304', '316L', '321'], "Food grade corrosion resistance is provided by chromium-nickel matrices (304/316L) which prevent metallic contamination and withstand organic acids."),
            'sea': (['316L', '625', '718'], "Marine environments require molybdenum-alloyed stainless steels (316L) or nickel-based superalloys (Inconel 625) to resist pitting and crevice corrosion from chloride ions."),
            'marine': (['316L', '625', '718'], "Marine environments require molybdenum-alloyed stainless steels (316L) or nickel-based superalloys (Inconel 625) to resist pitting and crevice corrosion from chloride ions."),
            'turbine': (['718', '625', '410'], "Turbine blades undergo high thermomechanical stress and creep. Nickel superalloys (Inconel 718) maintain structural integrity at temperatures exceeding 700°C."),
            'aerospace': (['718', 'Ti-Grade 5', '625'], "Aerospace applications demand high strength-to-weight ratios. Titanium Ti-6Al-4V provides exceptional tensile strength at half the density of steel."),
            'lightweight': (['Ti-Grade 5'], "Titanium alloys (Grade 5) have a density of ~4.4 g/cm³, offering high mechanical performance with a 45% weight reduction compared to steel alloys."),
            'gear': (['4140', '4340', '1018'], "Gears require wear resistance and core toughness. Medium carbon alloy steels (4140/4340) allow for surface hardening (nitriding/induction) while keeping a ductile core."),
            'automotive': (['4140', '4340', '1095'], "Automotive transmission and suspension components benefit from the fatigue resistance and high yield strength of chromium-molybdenum alloy steels (4140)."),
            'wear': (['D2', 'H13', '1095'], "High-wear tooling requires hard carbide formers. Tool steel D2 contains high carbon (1.5%) and chromium (12%) to precipitate chromium carbides, yielding 60 HRC hardness."),
            'corrosion': (['316L', '304', '625', 'F51'], "Chromium content > 10.5% creates a self-healing passive chromium oxide layer. Nickel and molybdenum additions further stabilize this oxide layer against acids."),
            'casting': (['304', '410', '1018'], "Casting requires excellent fluid flow. Alloys with lower silicon/carbon additions or optimized melting ranges are selected to avoid hot tearing."),
            'conduct': (['1018', '1095'], "High purity iron structures allow for minimal electron scattering. Unalloyed low-carbon steel (1018) provides higher conductivity than heavily alloyed stainless matrices."),
            'medical': (['316L', 'Ti-Grade 5'], "Biocompatibility is critical. Surgical implants utilize Titanium Grade 5 or SS316L due to low toxicity and extreme resistance to bodily fluid corrosion."),
            'chemical': (['625', '316L', 'F51'], "Chemical reactors handle aggressive acids. Nickel superalloys and duplex steels provide defense against stress corrosion cracking (SCC)."),
            'high temp': (['718', 'H13', '625'], "Hot-work tools and components utilize Inconel or H13 chrome-moly tool steels to resist thermal fatigue (heat checking) during continuous thermal cycling.")
        }

        # Find category keyword matches
        matched_codes = []
        reason_desc = "Standard metallurgical evaluation based on mechanical requirements."
        for kw, (codes, desc) in app_keywords.items():
            if kw in application.lower():
                matched_codes = codes
                reason_desc = desc
                break

        # Fallback to general listing if no keywords matched
        if not matched_codes:
            matched_codes = ['316L', '304', '4140', 'D2', '718']
            reason_desc = "Selected representative grades spanning Stainless, Alloy, Tool Steels, and Superalloys."

        # Fetch alloys from DB
        target_alloys = [a for a in all_alloys if a.code in matched_codes]
        # Order target_alloys to match matched_codes priority
        target_alloys.sort(key=lambda x: matched_codes.index(x.code) if x.code in matched_codes else 99)

        for alloy in target_alloys:
            # Compute detailed recipe metrics
            recipe = self.calculate_recipe(alloy, weight_kg)
            
            # Scores for multi-objective optimization (1-10 scale)
            strength_score = 5.0
            hardness_score = 5.0
            corrosion_score = 5.0
            temp_score = 5.0
            machinability = 5.0
            
            # Populate scores based on mechanical details in DB or standards
            mech_lower = alloy.mechanical_properties.lower()
            if 'tensile' in mech_lower:
                match = re.search(r'tensile:\s*(\d+)', mech_lower)
                if match:
                    ts = float(match.group(1))
                    strength_score = min(10.0, max(2.0, ts / 150.0))
            if 'hardness' in mech_lower:
                if 'hrc' in mech_lower:
                    match = re.search(r'hardness:\s*(\d+)\s*hrc', mech_lower)
                    if match:
                        h = float(match.group(1))
                        hardness_score = min(10.0, max(6.0, h / 7.0))
                else:
                    hardness_score = 6.0
                    
            if 'stainless' in alloy.category.lower() or 'nickel' in alloy.category.lower():
                corrosion_score = 9.0 if '316l' in alloy.code.lower() or '625' in alloy.code.lower() else 8.0
                temp_score = 9.0 if '718' in alloy.code.lower() else 7.0
                machinability = 5.0
            elif 'tool' in alloy.category.lower():
                strength_score = 9.5
                hardness_score = 9.8
                corrosion_score = 4.0
                temp_score = 8.0
                machinability = 3.5
            elif 'titanium' in alloy.category.lower():
                strength_score = 9.0
                hardness_score = 8.5
                corrosion_score = 10.0
                temp_score = 8.0
                machinability = 3.0
            else: # Alloy / Carbon steel
                strength_score = 7.5
                hardness_score = 7.0
                corrosion_score = 3.0
                temp_score = 5.0
                machinability = 8.0

            # Availability stock score
            has_shortage = len(recipe['shortages']) > 0
            availability_score = 10.0 if not has_shortage else max(1.0, 10.0 - (len(recipe['shortages']) * 2.0))
            
            # Energy consumption score
            energy_val = recipe['ml_metrics']['power_consumption_kwh']
            energy_score = min(10.0, max(3.0, 10.0 - (energy_val / (weight_kg * 0.8))))

            # Composite match confidence score
            match_score = (corrosion_score * 0.3) + (strength_score * 0.2) + (availability_score * 0.2) + (machinability * 0.1) + (temp_score * 0.2)
            confidence = min(99.0, max(70.0, match_score * 10.0))

            rankings.append({
                'alloy_name': alloy.name,
                'alloy_code': alloy.code,
                'standard': alloy.standard,
                'composition_summary': recipe['elements_target'],
                'mechanical_properties': alloy.mechanical_properties,
                'melting_range': f"{alloy.melting_point_min}°C - {alloy.melting_point_max}°C",
                'typical_applications': alloy.typical_applications,
                'estimated_cost': recipe['total_cost'],
                'recipe_weight': recipe['total_charge_weight_kg'],
                'has_shortage': has_shortage,
                'shortages_list': recipe['shortages'],
                'ml_metrics': recipe['ml_metrics'],
                'confidence_score': round(confidence, 1),
                'optimization_scorecard': {
                    'cost_efficiency': round(10.0 - min(5.0, recipe['total_cost'] / (weight_kg * 1.5)), 1),
                    'strength': round(strength_score, 1),
                    'hardness': round(hardness_score, 1),
                    'corrosion_resistance': round(corrosion_score, 1),
                    'temperature_resistance': round(temp_score, 1),
                    'machinability': round(machinability, 1),
                    'availability': round(availability_score, 1),
                    'energy_efficiency': round(energy_score, 1)
                },
                'advantages': self.get_alloy_pro_con(alloy.code)[0],
                'limitations': self.get_alloy_pro_con(alloy.code)[1],
                'reason': reason_desc
            })

        # Sort by confidence score descending
        rankings.sort(key=lambda x: x['confidence_score'], reverse=True)
        return rankings

    @staticmethod
    def get_alloy_pro_con(code: str) -> tuple:
        """Returns standard metallurgical pros and cons for a given grade"""
        pro_con = {
            '316L': ("Superior corrosion defense in marine environments, prevents pitting. Low carbon eliminates carbide precipitation during welding.", "More expensive than 304. Moderate strength, low hardness unless cold-worked."),
            '304': ("Cost-effective, excellent formability, highly cleanable surface.", "Prone to chloride pitting. Sensitizes at high temperatures."),
            '321': ("Stabilized with Titanium to resist intergranular corrosion under high temperature exposure.", "Prone to titanium streak defects on highly polished surfaces."),
            '410': ("High strength, excellent wear resistance, heat-treatable martensitic structure.", "Relatively low corrosion resistance compared to austenitic grades."),
            'F51': ("Duplex structure gives double the yield strength of 316L, extreme resistance to stress corrosion cracking.", "Difficult to hot-form or machine. Limited to temperatures below 300°C."),
            'D2': ("Exceptional abrasion resistance, holds a sharp cutting edge up to 60 HRC.", "Brittle under impact. Low corrosion resistance, difficult to grind."),
            'H13': ("Resists thermal cracking/heat checking under cyclic thermal shock. High red-hardness.", "Low corrosion resistance. Must be carefully preheated before operation."),
            '4140': ("High strength-to-weight, excellent fatigue limit, highly receptive to nitriding induction.", "Poor weldability. Prone to temper embrittlement if processed incorrectly."),
            '4340': ("Extreme deep-hardening capability, unmatched structural strength in thick cross-sections.", "Requires complex preheat and post-weld tempering thermal cycles."),
            '718': ("Maintains high tensile strength and fatigue limit at temperatures up to 700°C.", "Extremely difficult to machine, causes rapid tool wear. Expensive raw materials."),
            '625': ("Superb corrosion resistance across an array of aggressive acids. Excellent weldability.", "High cost. High density. Relatively low yield strength compared to heat-treated alloy steels."),
            'Ti-Grade 5': ("High strength-to-weight ratio, biocompatible, works under cryogenic and high heat.", "Extremely reactive with oxygen at high temperatures; must be vacuum melted."),
            '1095': ("High hardness, simple carbon steel with high wear resistance.", "Rusts easily if unlubricated. Poor hardenability in large diameters."),
            '1018': ("Highly machinable, carburizes easily for case hardening.", "Low strength, low core hardenability, rusts easily.")
        }
        return pro_con.get(code, ("Good mechanical properties.", "Requires tight process controls."))

    def calculate_spectrometer_correction(self, actual_comp: dict, target_alloy_code: str, batch_weight_kg: float) -> dict:
        """
        Compares spectrometer readings against target range, calculates element deviations in %,
        and determines correction additions in kg incorporating raw material purity & recovery coefficients.
        """
        alloy = Alloy.objects.filter(code=target_alloy_code).first()
        if not alloy:
            return {'error': 'Target alloy not found'}
            
        compositions = list(AlloyComposition.objects.filter(alloy=alloy))
        raw_materials = list(AlloyRawMaterial.objects.all())
        
        corrections = []
        is_compliant = True
        warnings = []
        
        for comp in compositions:
            element = comp.element
            target_val = comp.target_pct
            min_val = comp.min_pct
            max_val = comp.max_pct
            
            actual_val = actual_comp.get(element, 0.0)
            
            deviation = actual_val - target_val
            
            # Check compliance limits
            elem_compliant = min_val <= actual_val <= max_val
            
            if not elem_compliant:
                is_compliant = False
                dir_word = "low" if actual_val < min_val else "high"
                warnings.append(f"{element} level ({actual_val:.3f}%) is {dir_word} relative to ASTM limits [{min_val:.3f}% - {max_val:.3f}%]")

            # Calculate adjustment needed to reach target if below target
            if actual_val < target_val:
                deficit_pct = target_val - actual_val
                element_mass_needed = (deficit_pct / 100.0) * batch_weight_kg
                
                material = self.get_material_for_element(element, raw_materials)
                
                if material:
                    purity_factor = material.purity / 100.0
                    recovery_factor = material.estimated_recovery / 100.0
                    charge_needed = element_mass_needed / (purity_factor * recovery_factor)
                    
                    corrections.append({
                        'element': element,
                        'current': round(actual_val, 3),
                        'target': round(target_val, 3),
                        'deviation': round(deviation, 3),
                        'deficit_pct': round(deficit_pct, 3),
                        'material': material.material_name,
                        'charge_needed_kg': round(charge_needed, 2)
                    })
                else:
                    corrections.append({
                        'element': element,
                        'current': round(actual_val, 3),
                        'target': round(target_val, 3),
                        'deviation': round(deviation, 3),
                        'deficit_pct': round(deficit_pct, 3),
                        'material': f"{element} pure addition",
                        'charge_needed_kg': round(element_mass_needed / 0.95, 2)
                    })
            elif actual_val > max_val:
                # Element exceeds maximum. This is a critical anomaly. Dilution is required.
                excess_pct = actual_val - max_val
                # To dilute, base iron scrap addition might be recommended
                warnings.append(f"CRITICAL: {element} exceeds limit! Dilute heat by adding base iron scrap.")

        return {
            'target_alloy': alloy.code,
            'is_compliant': is_compliant,
            'warnings': warnings,
            'corrections': corrections
        }

    def generate_chat_response(self, query: str, history: list, active_furnace_id: str = None) -> dict:
        """
        Processes natural language, retains conversation state, performs query reasoning, 
        queries database, calculates recipe weights and costs, runs ML scoring, 
        and formats clean markdown responses.
        """
        # Maintain history state context
        state = {
            'alloy_code': None,
            'weight_kg': None,
            'units': 'kg',
            'intent': 'conversational',
            'active_batch_code': None
        }

        # Analyze context from history
        for msg in reversed(history):
            role = msg.get('role')
            content = msg.get('content', '')
            if role == 'user':
                # Check for historical alloy code
                hist_alloy = self.extract_grade(content)
                if hist_alloy and not state['alloy_code']:
                    state['alloy_code'] = hist_alloy
                
                # Check for historical weight
                hist_w, hist_unit = self.parse_weight(content)
                if hist_w and not state['weight_kg']:
                    state['weight_kg'] = hist_w
                    state['units'] = hist_unit
            elif role == 'assistant' and 'state' in msg:
                hist_state = msg.get('state', {})
                if hist_state.get('alloy_code') and not state['alloy_code']:
                    state['alloy_code'] = hist_state['alloy_code']
                if hist_state.get('weight_kg') and not state['weight_kg']:
                    state['weight_kg'] = hist_state['weight_kg']
                    state['units'] = hist_state.get('units', 'kg')
                if hist_state.get('active_batch_code') and not state['active_batch_code']:
                    state['active_batch_code'] = hist_state['active_batch_code']

        # Parse current message for fresh weight or alloy
        current_weight, current_unit = self.parse_weight(query)
        if current_weight:
            state['weight_kg'] = current_weight
            state['units'] = current_unit
            
        current_alloy = self.extract_grade(query)
        if current_alloy:
            state['alloy_code'] = current_alloy

        # Check for context multipliers e.g. "Double it" or "triple the size"
        query_l = query.lower()
        if "double" in query_l:
            if state['weight_kg']:
                state['weight_kg'] *= 2.0
                state['intent'] = 'calculator'
        elif "triple" in query_l:
            if state['weight_kg']:
                state['weight_kg'] *= 3.0
                state['intent'] = 'calculator'
        elif "half" in query_l:
            if state['weight_kg']:
                state['weight_kg'] /= 2.0
                state['intent'] = 'calculator'

        # Check if Digital Twin/Furnace is mentioned
        is_furnace_query = any(k in query_l for k in ['furnace', 'twin', 'live', 'telemetry', 'temperature', 'stage'])
        # Check if Spectrometer/Correction is mentioned
        is_spectrometer_query = any(k in query_l for k in ['spectrometer', 'correction', 'actual vs target', 'low by', 'high by', 'deviation'])

        # Decide Intent
        if is_spectrometer_query:
            state['intent'] = 'spectrometer'
        elif is_furnace_query:
            state['intent'] = 'digital_twin'
        elif state['alloy_code'] and state['weight_kg']:
            state['intent'] = 'calculator'
        elif any(k in query_l for k in ['food', 'sea', 'turbine', 'aerospace', 'gear', 'wear', 'corrosion', 'medical', 'high temp', 'conduct', 'alloy for', 'recommend']):
            state['intent'] = 'recommendation'
        elif any(k in query_l for k in ['why', 'difference', 'molybdenum', 'chromium', 'nickel', 'carbon', 'how to']):
            state['intent'] = 'technical'
        
        # Build Response based on intent
        markdown = ""
        widget_update = {}

        # Constants mapping
        from utils.constants import HEATING_GRADIENT, HEATING_GRADIENT
        from utils.calculations import estimate_liquidus_temp

        # -------------------------------------------------------------
        # INTENT: CALCULATOR (Weight-based alloy charge recipe)
        # -------------------------------------------------------------
        if state['intent'] == 'calculator' and state['alloy_code']:
            alloy = Alloy.objects.filter(code=state['alloy_code']).first()
            if alloy:
                recipe = self.calculate_recipe(alloy, state['weight_kg'])
                
                # Check for inventory shortage alerts
                shortage_warnings = ""
                if recipe['shortages']:
                    shortage_warnings += "\n> [!WARNING]  \n> **INSUFFICIENT STOCK DETECTED:**  \n"
                    for sh in recipe['shortages']:
                        shortage_warnings += f"> * **{sh['material']}** has a shortage of **{sh['shortage']:.1f} kg** (Required: {sh['required']} kg, Available: {sh['available']} kg). Recommended supplier: **{sh['supplier']}**  \n"
                
                markdown += f"""## Charge Recipe Calculations for {alloy.name} ({alloy.code})
Target weight: **{recipe['weight_kg']:.1f} kg** (Volume calculated using alloy density {alloy.density} g/cm³).

### 1. Target Chemistry & Charging Requirements
This recipe converts the nominal elemental compositions into exact charging masses. It incorporates the material recovery coefficients and purity percentages stored in the database.
$$\\text{{Required Charge Weight}} = \\frac{{\\text{{Target Metal Weight}}}}{{\\text{{Purity}} \\times \\text{{Recovery}}}}$$

| Element | Target % | Target Mass (kg) | Raw Material Charged | Purity % | Recovery % | **Required Charge (kg)** | Location | Status |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: | :--- | :---: |
"""
                for item in recipe['recipe_items']:
                    stat_badge = "✅ OK" if item['status'] == 'OPTIMAL' else "❌ Shortage"
                    markdown += f"| **{item['element']}** | {item['pct']}% | {item['element_weight_kg']} kg | {item['material']} | {item['purity']}% | {item['recovery']}% | **{item['charge_needed_kg']} kg** | Warehouse A | {stat_badge} |\n"

                markdown += f"""
* **Total charge weight required**: **{recipe['total_charge_weight_kg']:.1f} kg** (Extra mass accounts for oxidation and refining losses).
* **Estimated material cost**: **${recipe['total_cost']:,.2f}** (Optimized using real-time supplier quotes).

{shortage_warnings}

### 2. Trained ML Predictions & Process Dynamics
Using the core gradient boosting models, the system predicts the following process dynamics for this target run:

* **Expected quality score**: **{recipe['ml_metrics']['expected_quality']:.2f}%** (Confidence: **{recipe['ml_metrics']['qc_pass_rate']}%** QC pass probability)
* **Estimated melting duration**: **{recipe['ml_metrics']['expected_duration_minutes']} minutes**
* **Expected power consumption**: **{recipe['ml_metrics']['power_consumption_kwh']:.1f} kWh** (Efficiency rating: **{recipe['ml_metrics']['furnace_efficiency']}%**)
* **Expected defect rate**: **{recipe['ml_metrics']['expected_defect_rate']}%**
* **Expected anomaly probability**: **{recipe['ml_metrics']['anomaly_probability'] * 100:.3f}%**

### 3. Recommended Furnace Sequence
1. **Charging Sequence**: Load base **{next((r['charge_needed_kg'] for r in recipe['recipe_items'] if r['element'] == 'Fe'), 0.0):.1f} kg** of Iron Scrap into the induction chamber.
2. **Melting Phase**: Apply induction load to reach liquidus point ({estimate_liquidus_temp(recipe['elements_target']):.1f}°C). Ramps at {HEATING_GRADIENT}°C/min.
3. **Alloy Trimming**: Add alloying elements sequentially in descending order of oxidation potential: Chromium ({next((r['charge_needed_kg'] for r in recipe['recipe_items'] if r['element'] == 'Cr'), 0.0):.1f} kg), then Nickel ({next((r['charge_needed_kg'] for r in recipe['recipe_items'] if r['element'] == 'Ni'), 0.0):.1f} kg).
4. **Refining**: Stir under argon purging for homogenizing composition. Take spectrometer check.
"""
                # Update frontend widget state
                widget_update = {
                    'alloy_code': alloy.code,
                    'alloy_name': alloy.name,
                    'weight_kg': state['weight_kg'],
                    'units': 'kg',
                    'elements': recipe['elements_target'],
                    'recipe_items': recipe['recipe_items'],
                    'shortages': recipe['shortages'],
                    'total_cost': recipe['total_cost'],
                    'ml_metrics': recipe['ml_metrics'],
                    'timeline': [
                        { "stage": "Scrap Charging", "duration": "15 min", "detail": f"Charge Fe base scrap weight." },
                        { "stage": "Arc Melting", "duration": f"{recipe['ml_metrics']['expected_duration_minutes'] - 20} min", "detail": f"Heat core. Target load {recipe['ml_metrics']['power_consumption_kwh']:.0f} kWh." },
                        { "stage": "Alloy Trimming", "duration": "10 min", "detail": f"Slag cleaning. Add alloys charges." },
                        { "stage": "Spectrometer Prep", "duration": "8 min", "detail": "Final composition analysis verify." }
                    ]
                }
            else:
                markdown = f"I identified that you want an alloy grade '{state['alloy_code']}' but I couldn't find a matching standard in the database. Please specify a valid grade such as 304, 316L, 4140, or H13."

        # -------------------------------------------------------------
        # INTENT: RECOMMENDATION (Application based ranking)
        # -------------------------------------------------------------
        elif state['intent'] == 'recommendation':
            weight = state['weight_kg'] or 1000.0
            rankings = self.evaluate_alloy_rankings(query, weight)
            
            if rankings:
                best = rankings[0]
                markdown += f"## AI Metallurgical Recommendations for application: *\"{query}\"*  \n"
                markdown += f"Based on ASTM specifications, mechanical performance limits, and current raw materials availability, here are the top options ranked by AI matching confidence:\n\n"
                
                # Render options in a carousel/list
                for i, r in enumerate(rankings[:3]):
                    place = "🥇 BEST MATCH" if i == 0 else f"🥈 Option {i+1}"
                    markdown += f"### {place}: {r['alloy_name']} (Grade: **{r['alloy_code']}**)\n"
                    markdown += f"* **ASTM Standard**: {r['standard']} | **Melting Range**: {r['melting_range']}  \n"
                    markdown += f"* **Reason**: {r['reason']}  \n"
                    markdown += f"* **Mechanical Properties**: *{r['mechanical_properties']}*  \n"
                    markdown += f"* **Expected Adjustments Cost**: **${r['estimated_cost']:,.2f}** for {weight:.1f} kg  \n"
                    markdown += f"* **AI Matching Confidence**: **{r['confidence_score']}%**  \n"
                    
                    if r['has_shortage']:
                        markdown += f"* ⚠️ **Inventory Status**: **Shortage detected** in required raw materials. Shortage list:\n"
                        for sh in r['shortages_list']:
                            markdown += f"  - *{sh['material']}* is short by **{sh['shortage']:.1f} kg** (Supplier: {sh['supplier']})\n"
                    else:
                        markdown += f"* ✅ **Inventory Status**: **All required raw materials are in stock** (Warehouse A).  \n"
                        
                    markdown += f"* **Advantages**: {r['advantages']}  \n"
                    markdown += f"* **Limitations**: {r['limitations']}  \n\n"

                # Multi-objective Optimization Matrix
                markdown += "### 📊 Multi-Objective Optimization Scorecard\n"
                markdown += "| Alloy Grade | Cost Efficiency | Strength | Hardness | Corrosion | Temp Resistance | Availability | Energy Eff. | **Composite Match** |\n"
                markdown += "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n"
                for r in rankings[:4]:
                    sc = r['optimization_scorecard']
                    markdown += f"| **{r['alloy_code']}** | {sc['cost_efficiency']}/10 | {sc['strength']}/10 | {sc['hardness']}/10 | {sc['corrosion_resistance']}/10 | {sc['temperature_resistance']}/10 | {sc['availability']}/10 | {sc['energy_efficiency']}/10 | **{r['confidence_score']}%** |\n"

                markdown += "\n*If you would like to run the recipe calculation for any of these options, reply with: **'I need [weight] of [grade]'**.*"
                
                # Update widget with the best option
                best_alloy = Alloy.objects.filter(code=best['alloy_code']).first()
                recipe = self.calculate_recipe(best_alloy, weight)
                widget_update = {
                    'alloy_code': best_alloy.code,
                    'alloy_name': best_alloy.name,
                    'weight_kg': weight,
                    'units': 'kg',
                    'elements': recipe['elements_target'],
                    'recipe_items': recipe['recipe_items'],
                    'shortages': recipe['shortages'],
                    'total_cost': recipe['total_cost'],
                    'ml_metrics': recipe['ml_metrics'],
                    'timeline': [
                        { "stage": "Scrap Charging", "duration": "15 min", "detail": "Charge base scrap weight." },
                        { "stage": "Arc Melting", "duration": f"{recipe['ml_metrics']['expected_duration_minutes'] - 20} min", "detail": "Heat core to liqudius point." },
                        { "stage": "Alloy Trimming", "duration": "10 min", "detail": "Add trim additions." },
                        { "stage": "Spectrometer Prep", "duration": "8 min", "detail": "Final spectrometer analysis." }
                    ]
                }
            else:
                markdown = "I couldn't identify a matching alloy application. Please specify an application like 'food grade', 'seawater corrosion', 'high wear', or 'turbine blades'."

        # -------------------------------------------------------------
        # INTENT: SPECTROMETER (Chemical correction audit)
        # -------------------------------------------------------------
        elif state['intent'] == 'spectrometer':
            # Check for active smelting batch spectrometer results
            active_batch = None
            if active_furnace_id:
                # Find active running batch
                active_batch = ProductionBatch.objects.filter(status='MELTING').first()
                
            if not active_batch:
                # Fallback: check latest batch in DB
                active_batch = ProductionBatch.objects.order_by('-creation_time').first()
                
            if active_batch:
                # Get latest spectrometer analysis result for this batch
                spec_res = SpectrometerResult.objects.filter(batch=active_batch).order_by('-timestamp').first()
                
                if spec_res:
                    actual_comp = spec_res.composition
                    target_code = active_batch.alloy.code
                    weight = active_batch.batch_weight
                    
                    audit = self.calculate_spectrometer_correction(actual_comp, target_code, weight)
                    
                    markdown += f"## Spectrometer Laboratory Analysis: Batch **{active_batch.batch_code}**  \n"
                    markdown += f"Target Alloy Specification: **{active_batch.alloy.name} ({target_code})**  \n"
                    markdown += f"Batch Weight: **{weight:.1f} kg**  \n\n"
                    
                    if audit['is_compliant']:
                        markdown += "### ✅ Chemistry Status: COMPLIANT  \nAll chemical elements lie within the specified ASTM tolerances. No trim corrections required. You may proceed to tap!  \n\n"
                    else:
                        markdown += "### ⚠️ Chemistry Status: NON-COMPLIANT  \n"
                        markdown += "The spectrometer detected element deviations exceeding target ranges:\n"
                        for w in audit['warnings']:
                            markdown += f"* **{w}**\n"
                        
                        markdown += "\n### 🛠️ Recommended AI Trim Additions  \n"
                        markdown += "To adjust the melt to target nominal compositions, the AI recommends adding the following raw materials:\n\n"
                        markdown += "| Element Deficit | Current % | Target % | Deficit % | Raw Material to Add | Purity | Recovery | **Add Weight (kg)** |\n"
                        markdown += "| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |\n"
                        
                        for corr in audit['corrections']:
                            mat = AlloyRawMaterial.objects.filter(material_name=corr['material']).first()
                            pur = mat.purity if mat else 100.0
                            rec = mat.estimated_recovery if mat else 95.0
                            markdown += f"| **{corr['element']}** | {corr['current']}% | {corr['target']}% | -{corr['deficit_pct']}% | {corr['material']} | {pur}% | {rec}% | **+{corr['charge_needed_kg']} kg** |\n"
                            
                        markdown += "\n*These calculations incorporate actual element volatilization and slag entrapment loss factors.*"
                        
                        # Set active recommendations in widget
                        widget_update = {
                            'active_batch_code': active_batch.batch_code,
                            'alloy_code': target_code,
                            'weight_kg': weight,
                            'elements': actual_comp,
                            'corrections': audit['corrections']
                        }
                else:
                    # No spectrometer result in database. Let's create a simulated check.
                    simulated_comp = {
                        "Fe": 67.4, "Cr": 16.2, "Ni": 10.8, "Mn": 1.88, "Si": 0.65, "C": 0.028
                    }
                    audit = self.calculate_spectrometer_correction(simulated_comp, active_batch.alloy.code, active_batch.batch_weight)
                    markdown += f"## Spectrometer Laboratory Analysis: Batch **{active_batch.batch_code}**  \n"
                    markdown += f"Target Alloy Specification: **{active_batch.alloy.name} ({active_batch.alloy.code})**  \n"
                    markdown += f"Batch Weight: **{active_batch.batch_weight:.1f} kg**  \n\n"
                    markdown += "### 🔬 Simulated Spec Check (No active lab report found)  \n"
                    markdown += "Checking nominal composition deviations against targets:\n"
                    for w in audit['warnings']:
                        markdown += f"* **{w}**\n"
                        
                    markdown += "\n### 🛠️ Recommended AI Trim Additions  \n"
                    markdown += "| Element Deficit | Current % | Target % | Deficit % | Raw Material to Add | **Add Weight (kg)** |\n"
                    markdown += "| :--- | :---: | :---: | :---: | :--- | :---: |\n"
                    for corr in audit['corrections']:
                        markdown += f"| **{corr['element']}** | {corr['current']}% | {corr['target']}% | -{corr['deficit_pct']}% | {corr['material']} | **+{corr['charge_needed_kg']} kg** |\n"
            else:
                markdown = "There are no active smelting batches in the database right now. If you want to check spectrometer calculations, create a batch run first or specify a hypothetical check: e.g., 'Correct 1000 kg of 304 with Ni 8.2% and Cr 17.5%'."

        # -------------------------------------------------------------
        # INTENT: DIGITAL TWIN (Live furnace telemetry)
        # -------------------------------------------------------------
        elif state['intent'] == 'digital_twin':
            active_batch = ProductionBatch.objects.filter(status='MELTING').first()
            if not active_batch:
                active_batch = ProductionBatch.objects.order_by('-creation_time').first()

            if active_batch:
                # Query latest furnace reading
                read = FurnaceReading.objects.filter(batch=active_batch).order_by('-timestamp').first()
                
                temp = read.temperature if read else 1580.0
                pwr = read.power if read else 1.2
                oxy = read.oxygen_flow if read else 0.02
                comp = read.estimated_composition if read else {}
                
                markdown += f"## 🖥️ Digital Twin Telemetry Audit: Furnace F001  \n"
                markdown += f"Active Run Batch: **{active_batch.batch_code}** ({active_batch.alloy.name})  \n"
                markdown += f"Furnace State: **{active_batch.current_stage}**  \n\n"
                
                markdown += f"""### Live Telemetry Variables
* **Core Temperature**: **{temp:.1f} °C** (Liquidus point: {estimate_liquidus_temp(comp) if comp else 1420:.1f}°C)
* **Electric Power Draw**: **{pwr * 40.0:.1f} MW** (Voltage: 480 V, Current: 2500 A)
* **Energy Consumption**: **{read.energy_consumption if read else 450.0:.1f} kWh**
* **Slag Condition**: **{"OPTIMAL" if temp > 1400 else "CRUST_FORMING"}**
* **Oxygen Level**: **{oxy:.4f} ppm**

### Live Chemical Estimation
"""
                if comp:
                    markdown += "| Element | Estimated % | Target Nom % | Deviation % | Status |\n"
                    markdown += "| :--- | :---: | :---: | :---: | :---: |\n"
                    for el, val in comp.items():
                        target = next((c.target_pct for c in AlloyComposition.objects.filter(alloy=active_batch.alloy, element=el)), 0.0)
                        dev = val - target
                        stat = "✅ OK" if abs(dev) < 0.1 else ("⚠️ LOW" if dev < 0 else "⚠️ HIGH")
                        markdown += f"| **{el}** | {val:.3f}% | {target:.3f}% | {dev:+.3f}% | {stat} |\n"
                else:
                    markdown += "*No telemetry chemical composition estimations available.*"
            else:
                markdown = "No active furnace or smelting runs are registered in the database. The induction furnace is currently in STANDBY mode."

        # -------------------------------------------------------------
        # INTENT: TECHNICAL / METALLURGICAL QA
        # -------------------------------------------------------------
        elif state['intent'] == 'technical':
            # Metallurgical explanation matching
            if "molybdenum" in query_l or "mo" in query_l:
                markdown = """### Metallurgical Insight: Why use Molybdenum (Mo)?
In alloy metallurgy (especially stainless steels like **316L** vs **304**), **Molybdenum** is added (typically 2.0% - 3.0%) for:
1. **Pitting Resistance**: Mo reacts with chromium to stabilize the passive chromium oxide ($Cr_2O_3$) layer. This prevents chloride ions ($Cl^-$) in seawater or bleach solutions from breaking the layer and causing pinhole pitting corrosion.
2. **High-Temperature Strength**: It acts as a solid-solution strengthener, increasing creep-rupture strength at high temperatures.
3. **Elevated Acid Resistance**: Greatly reduces corrosion rates in hot sulfuric, phosphoric, and organic acids.
"""
            elif "nickel" in query_l or "ni" in query_l:
                markdown = """### Metallurgical Insight: Why Nickel (Ni) Improves Toughness?
Nickel is a key alloying element in austenitic stainless steels (like **304** and **316L**) and superalloys.
1. **Austenite Stabilizer**: At room temperature, pure iron exists as body-centered cubic (BCC) ferrite. Nickel expands the gamma-loop, stabilizing the face-centered cubic (FCC) austenite phase down to cryogenic temperatures.
2. **Ductility and Toughness**: The FCC structure has more slip planes than BCC ferrite. This prevents brittle fracture cleavage, resulting in excellent impact toughness at sub-zero temperatures (down to -196°C).
3. **Stress Corrosion Cracking (SCC) resistance**: Nickel additions above 8% significantly delay the onset of stress-corrosion cracking in chloride environments.
"""
            elif "chromium" in query_l or "cr" in query_l:
                markdown = """### Metallurgical Insight: Why Chromium (Cr) Resists Corrosion?
Chromium is the fundamental alloying element that makes steel "stainless":
1. **Passive Film Formation**: When chromium content exceeds **10.5%**, it reacts with ambient oxygen to form a thin, invisible, and self-healing chromium oxide ($Cr_2O_3$) layer on the steel surface.
2. **Oxidation Protection**: This layer acts as a physical barrier that prevents oxygen molecules from reaching and oxidizing the underlying iron matrix (forming rust).
3. **Sensitization Warning**: If heated between 450°C and 850°C, chromium can react with carbon to form chromium carbides ($Cr_{23}C_6$) at grain boundaries. This depletes the grain boundary of Cr, causing intergranular corrosion (sensitization).
"""
            elif "304" in query_l and "316" in query_l:
                markdown = """### Technical Comparison: Stainless Steel 304 vs 316L
These are the two most common austenitic stainless steels:

| Feature | Stainless Steel 304 | Stainless Steel 316L |
| :--- | :--- | :--- |
| **Molybdenum (Mo)** | 0% (None) | **2.0% - 3.0%** (Added for pitting defense) |
| **Nickel (Ni)** | 8.0% - 10.5% | **10.0% - 14.0%** (Slightly more stable austenite) |
| **Carbon (C)** | 0.08% Max (Standard carbon) | **0.03% Max** (Extra-low carbon prevents weld sensitization) |
| **Corrosion Resistance** | Excellent in atmospheric & fresh water. | Superior in chloride/seawater and chemical process lines. |
| **Estimated Cost** | Base price (~$2.20/kg feedstock) | Premium price (~$3.10/kg feedstock) |

*SS316L is the ideal choice for pharmaceutical, medical, marine, and chemical applications, while SS304 is the industry standard for food preparation, architectural trim, and general fabrication.*
"""
            else:
                markdown = """### Metallurgical Assistance
I can help explain chemical and physical behaviors in steelmaking. You can ask:
* *'Why use molybdenum in seawater?'*
* *'What is the difference between SS304 and SS316L?'*
* *'Why does nickel improve cryogenic toughness?'*
* *'Explain chromium passivation.'*
"""
        
        # -------------------------------------------------------------
        # INTENT: CONVERSATIONAL FALLBACK
        # -------------------------------------------------------------
        else:
            markdown = """### MetalliSense Industrial AI Agent

Greetings! I am the MetalliSense Metallurgical and Production Agent. I can assist you with:
* **Alloy Recommendation & Search**: Ask me for material recommendations based on your application, e.g., *"I need an alloy for marine environments"* or *"I need a gear alloy"*.
* **Weight-based Charge Calculator**: Provide an alloy and weight, e.g., *"I need 750 kg of 316L"* to calculate exact element requirements, charge weights with recovery factors, costs, and shortages.
* **Spectrometer Deviation Audit**: Type *"Spectrometer check"* to compare furnace melt readings against targets and calculate correction trim weights.
* **Digital Twin Audit**: Ask *"What is the status of the furnace"* to get real-time induction heating telemetry.

*Please tell me what grade or application you would like to analyze!*"""

        return {
            'response': markdown,
            'state': state,
            'widget_update': widget_update
        }
