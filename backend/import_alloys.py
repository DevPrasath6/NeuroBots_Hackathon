import os
import sys
import pandas as pd
import json
import django
import re

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'alloy_backend.settings')
django.setup()

from alloy_api.models import Alloy, AlloyComposition, AlloyRawMaterial, ProductionBatch, Inventory

# Define mappings from synthetic placeholder GR-* codes to genuine CSV names
GR_MAPPINGS = {
    "GR-10": "ACI-ASTM CE3MN (ASTM A890 Grade 5A, J93404) Cast Stainless Steel",
    "GR-22": "ACI-ASTM CE3MN (ASTM A890 Grade 5A, J93404) Cast Stainless Steel",
    "GR-34": "ACI-ASTM CE3MN (ASTM A890 Grade 5A, J93404) Cast Stainless Steel",
    "GR-11": "SAE-AISI A2 (T30102) Air-Hardening Steel",
    "GR-23": "SAE-AISI A2 (T30102) Air-Hardening Steel",
    "GR-35": "SAE-AISI A2 (T30102) Air-Hardening Steel",
    "GR-12": "SAE-AISI O1 (T31501) Oil-Hardening Steel",
    "GR-24": "SAE-AISI O1 (T31501) Oil-Hardening Steel",
    "GR-36": "SAE-AISI O1 (T31501) Oil-Hardening Steel",
    "GR-13": "SAE-AISI M2 (T11302) Molybdenum High-Speed Steel",
    "GR-25": "SAE-AISI M2 (T11302) Molybdenum High-Speed Steel",
    "GR-37": "SAE-AISI M2 (T11302) Molybdenum High-Speed Steel",
    "GR-14": "SAE-AISI 4130 (SCM430,G41300) Cr-Mo Steel",
    "GR-26": "SAE-AISI 4130 (SCM430,G41300) Cr-Mo Steel",
    "GR-38": "SAE-AISI 4130 (SCM430,G41300) Cr-Mo Steel",
    "GR-15": "SAE-AISI 8620 (SNCM220,G86200) Ni-Cr-Mo Steel",
    "GR-27": "SAE-AISI 8620 (SNCM220,G86200) Ni-Cr-Mo Steel",
    "GR-39": "SAE-AISI 8620 (SNCM220,G86200) Ni-Cr-Mo Steel",
    "GR-16": "SAE-AISI 1095 (SUP4, 1.1274, C100S, G10950) Carbon Steel",
    "GR-28": "SAE-AISI 1095 (SUP4, 1.1274, C100S, G10950) Carbon Steel",
    "GR-40": "SAE-AISI 1095 (SUP4, 1.1274, C100S, G10950) Carbon Steel",
    "GR-17": "SAE-AISI 1020 (S20C,G10200) Carbon Steel",
    "GR-29": "SAE-AISI 1020 (S20C,G10200) Carbon Steel",
    "GR-41": "SAE-AISI 1020 (S20C,G10200) Carbon Steel",
    "GR-18": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-30": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-19": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-31": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-20": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-32": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-21": "SAE-AISI 1018 (G10180) Carbon Steel",
    "GR-33": "SAE-AISI 1018 (G10180) Carbon Steel"
}

def parse_code_and_standard(name):
    # Extract code from brackets or prefix
    match = re.search(r'(?:AISI|SAE-AISI|ACI-ASTM)\s+([A-Za-z0-9\-\/]+)', name)
    if match:
        code = match.group(1)
        standard = name.split()[0]
    else:
        parts = name.split()
        code = parts[1] if len(parts) > 1 else parts[0]
        standard = parts[0]
    return code, standard

def run_optimization():
    print("=== STARTING METALLISENSE DATABASE OPTIMIZATION ===")
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'alloy_backend', 'dataset - metallisense', 'Alloys.csv')
    if not os.path.exists(csv_path):
        print(f"Error: Reference CSV not found at {csv_path}")
        return

    df = pd.read_csv(csv_path)
    
    # 1. Filter and parse CSV records
    csv_alloys = {}
    element_cols = ['Al','As','B','C','Ca','Ce','Co','Cr','Cu','Fe','La','Mg','Mn','Mo','N','Nb','Ni','O','P','Pb','S','Se','Si','Sn','Ta','Ti','V','W','Zn','Zr']

    for _, row in df.iterrows():
        alloy_name = row["Alloy"]
        if not isinstance(alloy_name, str) or " " not in alloy_name:
            continue  # Skip sluggified or empty names
            
        code, std = parse_code_and_standard(alloy_name)
        
        # Check melting range and tensile strength
        liq = row.get("Melting Completion (Liquidus)", 1450.0)
        uts = row.get("Tensile Strength: Ultimate (UTS) (psi)", 750.0)
        
        # Parse chemical composition
        compositions = {}
        for el in element_cols:
            val = float(row.get(el, 0.0))
            if val > 0:
                compositions[el] = val
                
        csv_alloys[alloy_name] = {
            "name": alloy_name,
            "code": code,
            "standard": std,
            "melting_max": int(liq),
            "melting_min": int(liq) - 50,
            "uts": uts,
            "compositions": compositions
        }

    print(f"Parsed {len(csv_alloys)} unique genuine alloy profiles from Alloys.csv.")

    # 2. Map category keywords
    def get_category(name):
        n = name.lower()
        if "stainless" in n or "cd3" in n or "ce3" in n or "cf3" in n or "cf8" in n:
            return "Stainless Steel"
        elif "tool" in n or "work steel" in n or "high-speed steel" in n:
            return "Tool Steel"
        elif "aluminum" in n or "aluminium" in n:
            return "Aluminium Alloys"
        elif "brass" in n or "bronze" in n or "copper" in n:
            return "Copper Alloys"
        elif "titanium" in n:
            return "Titanium Alloys"
        elif "inconel" in n or "nickel" in n:
            return "Nickel Superalloys"
        else:
            return "Carbon Steel"

    # Report counters
    alloys_updated = 0
    alloys_inserted = 0
    duplicates_removed = 0
    compositions_corrected = 0
    validation_errors_fixed = 0

    # Genuine target codes already processed to prevent duplicate records
    processed_genuine_codes = {}

    # 3. Process existing alloys to merge or replace placeholders
    existing_alloys = list(Alloy.objects.all())
    print(f"Scanning {len(existing_alloys)} database records...")

    for alloy in existing_alloys:
        # Check if this is a synthetic placeholder GR-* alloy
        if alloy.code.startswith("GR-"):
            genuine_name = GR_MAPPINGS.get(alloy.code)
            if not genuine_name or genuine_name not in csv_alloys:
                print(f"Skipping GR alloy {alloy.code} (no mapping found)")
                continue

            csv_data = csv_alloys[genuine_name]
            target_code = csv_data["code"]

            # Check if this genuine alloy is already present in PostgreSQL
            # (either pre-existing or created by a prior GR merge)
            target_alloy = Alloy.objects.filter(code__iexact=target_code).first()

            if target_alloy and target_alloy.id != alloy.id:
                # Merge duplicate! Move references to target_alloy and delete current alloy
                ProductionBatch.objects.filter(alloy=alloy).update(alloy=target_alloy)
                alloy.delete()
                duplicates_removed += 1
                validation_errors_fixed += 1
                print(f"Merged placeholder {alloy.code} into genuine {target_code} ({target_alloy.id})")
            else:
                # Replace current placeholder record with genuine parameters
                alloy.code = target_code
                alloy.name = csv_data["name"]
                alloy.category = get_category(alloy.name)
                alloy.standard = csv_data["standard"]
                alloy.melting_point_max = csv_data["melting_max"]
                alloy.melting_point_min = csv_data["melting_min"]
                alloy.mechanical_properties = f"Tensile Strength (UTS): {csv_data['uts']} psi"
                alloy.typical_applications = f"Genuine industrial grade steel matching standard {alloy.standard} limits."
                alloy.save()

                # Update compositions
                AlloyComposition.objects.filter(alloy=alloy).delete()
                for el, target_val in csv_data["compositions"].items():
                    # Calculate reasonable specification limits
                    if target_val < 1.0:
                        min_v = max(0.0, target_val - 0.05)
                        max_v = target_val + 0.05
                    elif target_val < 10.0:
                        min_v = max(0.0, target_val - 0.25)
                        max_v = target_val + 0.25
                    else:
                        min_v = max(0.0, target_val - 1.0)
                        max_v = target_val + 1.0

                    AlloyComposition.objects.create(
                        alloy=alloy,
                        element=el,
                        min_pct=round(min_v, 3),
                        max_pct=round(max_v, 3),
                        target_pct=round(target_val, 3)
                    )
                    compositions_corrected += 1

                alloys_updated += 1
                validation_errors_fixed += 1
                print(f"Replaced placeholder {alloy.code} with genuine {target_code}")
                
        else:
            # Non-placeholder alloy (e.g. 304, 316L, 1018, D2...)
            # Find the best match in the CSV to update metrics
            match_key = None
            for key, val in csv_alloys.items():
                if val["code"].lower() == alloy.code.lower():
                    match_key = key
                    break
            
            if match_key:
                csv_data = csv_alloys[match_key]
                alloy.name = csv_data["name"]
                alloy.melting_point_max = csv_data["melting_max"]
                alloy.melting_point_min = csv_data["melting_min"]
                alloy.mechanical_properties = f"Tensile Strength (UTS): {csv_data['uts']} psi"
                alloy.save()

                # Sync compositions
                AlloyComposition.objects.filter(alloy=alloy).delete()
                for el, target_val in csv_data["compositions"].items():
                    if target_val < 1.0:
                        min_v = max(0.0, target_val - 0.05)
                        max_v = target_val + 0.05
                    elif target_val < 10.0:
                        min_v = max(0.0, target_val - 0.25)
                        max_v = target_val + 0.25
                    else:
                        min_v = max(0.0, target_val - 1.0)
                        max_v = target_val + 1.0

                    AlloyComposition.objects.create(
                        alloy=alloy,
                        element=el,
                        min_pct=round(min_v, 3),
                        max_pct=round(max_v, 3),
                        target_pct=round(target_val, 3)
                    )
                    compositions_corrected += 1

                alloys_updated += 1
                print(f"Enriched existing grade {alloy.code} with reference metrics.")

    # 4. Insert missing industrial alloys (insert up to 100 new unique alloys to keep it clean)
    inserted_count = 0
    for name, data in list(csv_alloys.items())[:120]:
        # Skip if code already exists
        if Alloy.objects.filter(code__iexact=data["code"]).exists():
            continue

        alloy = Alloy.objects.create(
            code=data["code"],
            name=data["name"],
            category=get_category(name),
            standard=data["standard"],
            description=f"Standard industrial grade complying with {data['standard']} standards.",
            density=7.85,
            melting_point_min=data["melting_min"],
            melting_point_max=data["melting_max"],
            typical_applications=f"Heavy machinery, chemical refining, and standard structural components.",
            recommended_furnace="Induction Furnace",
            estimated_holding_time=45,
            mechanical_properties=f"Tensile Strength (UTS): {data['uts']} psi"
        )

        for el, target_val in data["compositions"].items():
            if target_val < 1.0:
                min_v = max(0.0, target_val - 0.05)
                max_v = target_val + 0.05
            elif target_val < 10.0:
                min_v = max(0.0, target_val - 0.25)
                max_v = target_val + 0.25
            else:
                min_v = max(0.0, target_val - 1.0)
                max_v = target_val + 1.0

            AlloyComposition.objects.create(
                alloy=alloy,
                element=el,
                min_pct=round(min_v, 3),
                max_pct=round(max_v, 3),
                target_pct=round(target_val, 3)
            )

        alloys_inserted += 1
        inserted_count += 1

    print(f"Inserted {alloys_inserted} new unique alloys into the database.")

    # 5. Populate and synchronize raw materials mapping details
    required_feedstocks = [
        {"material_name": "Iron Scrap", "purpose": "Base metal charging", "purity": 99.0, "estimated_recovery": 95.0, "supplier": "RecycleCorp", "unit_cost": 0.45},
        {"material_name": "Ferrochrome", "purpose": "Chromium addition", "purity": 65.0, "estimated_recovery": 98.5, "supplier": "ChromeGlobal", "unit_cost": 2.10},
        {"material_name": "Ferronickel", "purpose": "Nickel addition", "purity": 80.0, "estimated_recovery": 99.0, "supplier": "NickelAlloys Ltd", "unit_cost": 6.80},
        {"material_name": "Ferromanganese", "purpose": "Manganese addition", "purity": 75.0, "estimated_recovery": 96.0, "supplier": "ManganeseCorp", "unit_cost": 1.50},
        {"material_name": "Ferrosilicon", "purpose": "Silicon deoxidation and addition", "purity": 75.0, "estimated_recovery": 94.0, "supplier": "SiliconRefining", "unit_cost": 1.25},
        {"material_name": "Ferromolybdenum", "purpose": "Molybdenum addition", "purity": 60.0, "estimated_recovery": 98.0, "supplier": "MolyMetals", "unit_cost": 14.50},
        {"material_name": "Ni Metal", "purpose": "Pure Nickel trim", "purity": 99.5, "estimated_recovery": 99.5, "supplier": "NickelAlloys Ltd", "unit_cost": 18.50},
        {"material_name": "Carbon additive", "purpose": "Recarburization", "purity": 98.0, "estimated_recovery": 85.0, "supplier": "CarbonProducts", "unit_cost": 0.35},
        {"material_name": "Aluminium", "purpose": "Aluminium addition", "purity": 99.0, "estimated_recovery": 90.0, "supplier": "AluGlobal", "unit_cost": 2.20},
        {"material_name": "Copper", "purpose": "Copper addition", "purity": 99.0, "estimated_recovery": 92.0, "supplier": "CuProducts", "unit_cost": 4.50},
        {"material_name": "Titanium Sponge", "purpose": "Titanium addition", "purity": 98.0, "estimated_recovery": 88.0, "supplier": "TiMetals", "unit_cost": 9.50},
        {"material_name": "Vanadium", "purpose": "Vanadium addition", "purity": 98.0, "estimated_recovery": 92.0, "supplier": "VMetals", "unit_cost": 22.00},
        {"material_name": "Tungsten", "purpose": "Tungsten addition", "purity": 98.0, "estimated_recovery": 94.0, "supplier": "WMetals", "unit_cost": 28.50}
    ]

    for item in required_feedstocks:
        obj, created = AlloyRawMaterial.objects.update_or_create(
            material_name=item["material_name"],
            defaults={
                "purpose": item["purpose"],
                "purity": item["purity"],
                "estimated_recovery": item["estimated_recovery"],
                "supplier": item["supplier"],
                "unit_cost": item["unit_cost"]
            }
        )
        # Ensure there is inventory space initialized
        Inventory.objects.get_or_create(
            material=item["material_name"],
            defaults={
                "current_stock": 25000.0,
                "minimum_stock": 2000.0,
                "maximum_stock": 50000.0,
                "unit": "kg",
                "supplier": item["supplier"],
                "cost": item["unit_cost"],
                "location": "Warehouse A"
            }
        )

    # 6. Database Integrity Verification
    total_alloys = Alloy.objects.count()
    total_compositions = AlloyComposition.objects.count()
    total_mappings = AlloyRawMaterial.objects.count()
    broken_fks = 0
    
    # Check for composition integrity
    for comp in AlloyComposition.objects.all():
        if not comp.alloy:
            broken_fks += 1

    print("\n" + "="*45)
    print("       DATABASE OPTIMIZATION REPORT        ")
    print("="*45)
    print(f"Alloys Updated:              {alloys_updated}")
    print(f"New Alloys Inserted:         {alloys_inserted}")
    print(f"Duplicate Alloys Removed:    {duplicates_removed}")
    print(f"Compositions Corrected:      {compositions_corrected}")
    print(f"Validation Errors Fixed:     {validation_errors_fixed}")
    print(f"Total Alloys in DB:          {total_alloys}")
    print(f"Total Composition Records:   {total_compositions}")
    print(f"Total Raw Material Mappings: {total_mappings}")
    print(f"Broken Foreign Keys:         {broken_fks}")
    print("="*45)

if __name__ == '__main__':
    run_optimization()
