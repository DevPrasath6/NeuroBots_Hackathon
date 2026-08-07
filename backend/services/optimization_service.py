from typing import Dict, Any
from ai.prediction_engine import prediction_engine
from ai.recommendation_engine import RecommendationEngine

class OptimizationService:
    """Service to predict process optimization, recovery rates, and energy demands"""

    @staticmethod
    def optimize_heat_run(grade: str, target_composition: Dict[str, float], 
                          current_composition: Dict[str, float], 
                          batch_weight_tons: float) -> Dict[str, Any]:
        """
        Optimize chemical trim additions and calculate expected yield, energy consumption,
        and final mechanical quality scores using the trained ML model components.
        """
        # Get AI trim recommendations
        recommendations = RecommendationEngine.calculate_recommendations(
            target_composition, current_composition, batch_weight_tons
        )

        # Estimate energy usage using energy predictor
        # Inputs: lagging reactive=30, leading reactive=20, co2=0.08, lagging pf=0.9, leading pf=0.9, nsm=36000
        predicted_energy_kwh = prediction_engine.predict_energy(
            lagging_reactive=35.0,
            leading_reactive=15.0,
            co2=0.08,
            lagging_pf=0.88,
            leading_pf=0.92,
            nsm=36000.0
        )
        
        # Scale energy consumption relative to batch weight size
        total_energy_kwh = predicted_energy_kwh * (batch_weight_tons / 100.0)

        # Build feature vector to predict quality
        plate_features = {
            "current_C": current_composition.get("C", 0.0),
            "current_Si": current_composition.get("Si", 0.0),
            "current_Mn": current_composition.get("Mn", 0.0),
            "current_Cr": current_composition.get("Cr", 0.0),
            "current_Ni": current_composition.get("Ni", 0.0),
            "current_Mo": current_composition.get("Mo", 0.0),
            "Steel_Plate_Thickness": 12.0
        }
        expected_quality = prediction_engine.predict_quality_score(plate_features)
        anomaly_prob = prediction_engine.predict_anomaly_prob(plate_features)

        # Recovery rate estimates: metallurgical standard is ~92-98%
        recovery_rates = {}
        for element in target_composition:
            recovery_rates[element] = round(95.0 + (1.0 - anomaly_prob)*3.0, 2)

        return {
            "grade": grade,
            "target_weight_tons": batch_weight_tons,
            "recommended_additions": recommendations,
            "expected_energy_kwh": round(total_energy_kwh, 2),
            "expected_quality_score": round(expected_quality, 2),
            "anomaly_probability": round(anomaly_prob, 4),
            "recovery_rates": recovery_rates,
            "expected_material_losses_pct": round(2.5 + (anomaly_prob * 5.0), 2)
        }

optimization_service = OptimizationService()
