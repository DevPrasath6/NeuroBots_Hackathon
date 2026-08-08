import os
import sys
import pandas as pd
import json
import django

# Set up Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'alloy_backend.settings')
django.setup()

from alloy_api.models import (
    Alloy, AlloyComposition, AlloyRawMaterial, Inventory, UserOperator,
    EquipmentMaintenance, ModelRegistry, ProductionBatch, BatchRecipe, QualityReport,
    FurnaceReading
)

def seed():
    print("Starting database seeding...")
    
    if Alloy.objects.exists():
        print("Database already contains alloy specifications. Skipping seeding.")
        return
    
    # 1. Seed Alloys & Compositions from master_alloys.csv
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'datasets', 'master_alloys.csv')
    if not os.path.exists(csv_path):
        print(f"Error: master_alloys.csv not found at {csv_path}")
        return

    df = pd.read_csv(csv_path)
    
    # Clear existing in topological order to satisfy FK constraints
    QualityReport.objects.all().delete()
    FurnaceReading.objects.all().delete()
    BatchRecipe.objects.all().delete()
    ProductionBatch.objects.all().delete()
    AlloyComposition.objects.all().delete()
    Alloy.objects.all().delete()
    AlloyRawMaterial.objects.all().delete()
    Inventory.objects.all().delete()
    UserOperator.objects.all().delete()
    EquipmentMaintenance.objects.all().delete()
    ModelRegistry.objects.all().delete()

    print(f"Cleared existing tables. Seeding {len(df)} alloys...")

    for _, row in df.iterrows():
        # Get category based on name keywords
        name = row["Alloy Name"]
        if "Stainless" in name or "F51" in name or "F53" in name:
            category = "Stainless Steel"
        elif "Tool" in name:
            category = "Tool Steel"
        elif "Aluminum" in name:
            category = "Aluminium Alloys"
        elif "Brass" in name or "Bronze" in name:
            category = "Copper Alloys"
        elif "Titanium" in name:
            category = "Titanium Alloys"
        elif "Inconel" in name:
            category = "Nickel Superalloys"
        else:
            category = "Carbon Steel"

        alloy = Alloy.objects.create(
            code=row["Grade"],
            name=row["Alloy Name"],
            category=category,
            standard=row["Standard"],
            description=row["Typical Applications"],
            density=float(row["Density"]),
            melting_point_min=int(row["Melting Point"]) - 50,
            melting_point_max=int(row["Melting Point"]) + 50,
            typical_applications=row["Typical Applications"],
            recommended_furnace="Induction Furnace",
            estimated_holding_time=45,
            mechanical_properties=row["Mechanical Properties"]
        )

        # Seed compositions
        target_comp = json.loads(row["Target Chemical Composition"])
        limits = json.loads(row["Composition Limits"])

        for element, target_val in target_comp.items():
            elem_limits = limits.get(element, [target_val * 0.9, target_val * 1.1])
            AlloyComposition.objects.create(
                alloy=alloy,
                element=element,
                min_pct=round(elem_limits[0], 3),
                max_pct=round(elem_limits[1], 3),
                target_pct=round(target_val, 3)
            )

    print("Alloys and compositions seeded.")

    # 2. Seed Raw Materials
    raw_materials = [
        {"material_name": "Iron Scrap", "purpose": "Base metal charging", "purity": 99.0, "estimated_recovery": 95.0, "supplier": "RecycleCorp", "unit_cost": 0.45},
        {"material_name": "Ferrochrome", "purpose": "Chromium addition", "purity": 65.0, "estimated_recovery": 98.5, "supplier": "ChromeGlobal", "unit_cost": 2.10},
        {"material_name": "Ferronickel", "purpose": "Nickel addition", "purity": 80.0, "estimated_recovery": 99.0, "supplier": "NickelAlloys Ltd", "unit_cost": 6.80},
        {"material_name": "Ferromanganese", "purpose": "Manganese addition", "purity": 75.0, "estimated_recovery": 96.0, "supplier": "ManganeseCorp", "unit_cost": 1.50},
        {"material_name": "Ferrosilicon", "purpose": "Silicon deoxidation and addition", "purity": 75.0, "estimated_recovery": 94.0, "supplier": "SiliconRefining", "unit_cost": 1.25},
        {"material_name": "Ferromolybdenum", "purpose": "Molybdenum addition", "purity": 60.0, "estimated_recovery": 98.0, "supplier": "MolyMetals", "unit_cost": 14.50},
        {"material_name": "Ni Metal", "purpose": "Pure Nickel trim", "purity": 99.5, "estimated_recovery": 99.5, "supplier": "NickelAlloys Ltd", "unit_cost": 18.50},
        {"material_name": "Carbon additive", "purpose": "Recarburization", "purity": 98.0, "estimated_recovery": 85.0, "supplier": "CarbonProducts", "unit_cost": 0.35}
    ]

    for mat in raw_materials:
        AlloyRawMaterial.objects.create(**mat)
    print("Alloy raw materials seeded.")

    # 3. Seed Inventory Stocks
    for mat in raw_materials:
        Inventory.objects.create(
            material=mat["material_name"],
            current_stock=15000.0, # 15 tons
            minimum_stock=2000.0,  # 2 tons warning
            maximum_stock=50000.0, # 50 tons
            unit="kg",
            supplier=mat["supplier"],
            cost=mat["unit_cost"],
            location="Aisle B-Section 4"
        )
    print("Inventory stocks seeded.")

    # 4. Seed Operators
    operators = [
        {"username": "op_watas", "role": "operator"},
        {"username": "eng_smith", "role": "engineer"},
        {"username": "mgr_jones", "role": "manager"},
        {"username": "admin_chief", "role": "admin"}
    ]
    for op in operators:
        UserOperator.objects.create(**op)
    print("User operators seeded.")

    # 5. Seed Equipment Maintenance logs
    EquipmentMaintenance.objects.create(
        component_name="Refractory Lining",
        health_score=87.5,
        estimated_remaining_life="18 months",
        confidence_score=89.0,
        maintenance_status="Good"
    )
    EquipmentMaintenance.objects.create(
        component_name="Heating Coils",
        health_score=78.2,
        estimated_remaining_life="9 months",
        confidence_score=76.0,
        maintenance_status="Fair"
    )
    print("Equipment maintenance logs seeded.")

    # 6. Seed Model Registry
    ModelRegistry.objects.create(
        model_name="Anomaly Detector",
        algorithm="Random Forest Classifier",
        version="3.0",
        accuracy=0.9507,
        dataset_size=1941
    )
    ModelRegistry.objects.create(
        model_name="Energy Predictor",
        algorithm="Gradient Boosting Regressor",
        version="3.0",
        accuracy=0.9982,
        dataset_size=1000
    )
    ModelRegistry.objects.create(
        model_name="Quality Predictor",
        algorithm="Random Forest Regressor",
        version="3.0",
        accuracy=0.9998,
        dataset_size=1941
    )
    print("Model registry seeded.")

    # 7. Seed historical batches and quality reports for charts
    from datetime import timedelta
    import random
    
    alloy_316L = Alloy.objects.filter(code='316L').first()
    operator = UserOperator.objects.first()
    
    if alloy_316L and operator:
        for i in range(7):
            delta_hours = (7 - i) * 4
            batch_time = timezone.now() - timedelta(hours=delta_hours)
            batch = ProductionBatch.objects.create(
                batch_code=f"BATCH-HIST-{i}",
                alloy=alloy_316L,
                batch_weight=1000.0,
                weight_unit="kg",
                operator=operator.username,
                status='COMPLETED',
                current_stage='STAGE 5: COMPLETE & TAP',
                creation_time=batch_time,
                actual_completion=batch_time + timedelta(minutes=78),
                energy_used=42.5 + random.uniform(0.5, 4.0),
                production_duration=78
            )
            
            BatchRecipe.objects.create(
                batch=batch,
                material="Iron Scrap",
                theoretical_quantity=700.0,
                ai_optimized_quantity=700.0,
                actual_added_quantity=700.0,
                recovery_percentage=95.0
            )
            BatchRecipe.objects.create(
                batch=batch,
                material="Ferrochrome",
                theoretical_quantity=200.0,
                ai_optimized_quantity=200.0,
                actual_added_quantity=200.0,
                recovery_percentage=98.5
            )
            
            q_score = 92.0 + random.uniform(0.0, 3.5)
            QualityReport.objects.create(
                batch=batch,
                quality_score=round(q_score, 1),
                energy_used=batch.energy_used,
                production_time=78,
                number_of_spectrometer_samples=2,
                number_of_ai_recommendations=1,
                final_pass=True
            )
            
            # Create matching furnace readings for historical trend charts
            FurnaceReading.objects.create(
                batch=batch,
                timestamp=batch_time,
                temperature=1600.0 + random.uniform(-40.0, 40.0),
                voltage=480.0,
                current=2500.0,
                power=1.2,
                pressure=1.05 + random.uniform(-0.05, 0.05),
                oxygen_flow=12.5 + random.uniform(-1.0, 1.0),
                energy_consumption=450.0,
                predicted_quality=q_score,
                estimated_composition={
                    "Fe": 68.0 + random.uniform(-0.5, 0.5),
                    "Cr": 17.0 + random.uniform(-0.4, 0.4),
                    "Ni": 12.0 + random.uniform(-0.3, 0.3),
                    "Mo": 2.2 + random.uniform(-0.1, 0.1),
                    "Mn": 1.0 + random.uniform(-0.05, 0.05),
                    "Si": 0.5 + random.uniform(-0.05, 0.05),
                    "C": 0.02 + random.uniform(-0.003, 0.003)
                }
            )
        print("Historical batches, reports, and furnace readings seeded for charts.")

    print("Database seeding completed successfully!")

if __name__ == '__main__':
    from django.utils import timezone
    seed()
