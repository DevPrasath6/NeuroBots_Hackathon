import unittest
import os
import sys

# Add backend root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'alloy_backend.settings')
django.setup()

from services.alloy_service import alloy_service
from services.composition_service import composition_service
from services.optimization_service import optimization_service
from services.monitoring_service import monitoring_service

class TestMES_Services(unittest.TestCase):
    
    def test_alloy_catalog_loading(self):
        """Verify that the master_alloys.csv database is loaded correctly"""
        alloys = alloy_service.get_all_alloys()
        self.assertGreater(len(alloys), 10)
        
        # Check standard 316L specs
        alloy_316L = alloy_service.get_alloy_by_grade('316L')
        self.assertTrue("316L" in alloy_316L["Alloy Name"])
        self.assertAlmostEqual(alloy_316L["Density"], 7.85, delta=0.5)

    def test_batch_composition_calculations(self):
        """Verify element mass calculation formula logic"""
        res = composition_service.calculate_batch_composition('316L', 10.0) # 10 tons
        self.assertEqual(res["grade"], "316L")
        # 17% Cr of 10 tons = 1.7 tons = 1700 kg
        self.assertEqual(res["calculated_element_masses_kg"]["Cr"], 1700.0)

    def test_process_optimization_engine(self):
        """Verify AI process optimization response properties"""
        target_comp = {"Cr": 18.0, "Ni": 12.0}
        current_comp = {"Cr": 17.0, "Ni": 10.0}
        res = optimization_service.optimize_heat_run('316L', target_comp, current_comp, 100.0)
        
        self.assertEqual(res["grade"], "316L")
        self.assertGreater(res["expected_quality_score"], 70.0)
        self.assertGreater(res["expected_energy_kwh"], 0.0)
        self.assertGreater(len(res["recommended_additions"]), 0)

    def test_live_digital_twin_diagnostics(self):
        """Verify live monitoring digital twin telemetry updates"""
        sensor_data = {"C": 0.03, "Cr": 17.5, "Ni": 11.5}
        res = monitoring_service.get_live_furnace_diagnostics('F001', 1200.0, sensor_data)
        
        self.assertEqual(res["furnace_id"], "F001")
        self.assertEqual(res["stage"], "ACTIVE MELTING")
        self.assertGreater(res["predicted_quality_score"], 70.0)

if __name__ == '__main__':
    unittest.main()
