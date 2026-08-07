from typing import Dict, Any
from ai.prediction_engine import prediction_engine
from ai.digital_twin import DigitalTwinSimulator
from ai.recommendation_engine import RecommendationEngine

class MonitoringService:
    """Service to load live furnace sensor arrays and calculate real-time predictions"""

    @staticmethod
    def get_live_furnace_diagnostics(furnace_id: str, elapsed_seconds: float, 
                                     sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates live status metrics using physical twin status combined with ML model outputs
        """
        twin_state = DigitalTwinSimulator.get_live_metrics(furnace_id, elapsed_seconds)
        
        # Merge live sensor data if available
        temperature = sensor_data.get('temperature', twin_state['temperature'])
        oxygen_level = sensor_data.get('oxygen_level', twin_state['oxygen_level'])
        
        # Build features for ML predictions
        plate_features = {
            "current_C": sensor_data.get('C', 0.05),
            "current_Si": sensor_data.get('Si', 0.5),
            "current_Mn": sensor_data.get('Mn', 1.0),
            "current_Cr": sensor_data.get('Cr', 18.0),
            "current_Ni": sensor_data.get('Ni', 8.0),
            "current_Mo": sensor_data.get('Mo', 2.0),
            "Steel_Plate_Thickness": 12.0
        }

        # Predict quality and anomaly probability
        quality_score = prediction_engine.predict_quality_score(plate_features)
        anomaly_prob = prediction_engine.predict_anomaly_prob(plate_features)

        # Predict energy
        energy_kwh = prediction_engine.predict_energy(
            lagging_reactive=35.0,
            leading_reactive=15.0,
            co2=0.08,
            lagging_pf=0.88,
            leading_pf=0.92,
            nsm=36000.0
        )

        # AI Recommendations
        target_comp = {"Cr": 18.0, "Ni": 8.0, "Mo": 2.0}
        current_comp = {k.replace("current_", ""): v for k, v in plate_features.items() if k.startswith("current_")}
        recommendations = RecommendationEngine.calculate_recommendations(target_comp, current_comp)

        return {
            "furnace_id": furnace_id,
            "stage": twin_state["stage"],
            "melt_progress_pct": twin_state["progress"],
            "current_temperature": temperature,
            "oxygen_level": oxygen_level,
            "predicted_energy_kwh": round(energy_kwh, 2),
            "predicted_quality_score": round(quality_score, 2),
            "anomaly_probability": round(anomaly_prob, 4),
            "furnace_efficiency_pct": round(95.0 - (anomaly_prob * 10.0), 2),
            "remaining_production_time_min": max(0, round((4680.0 - elapsed_seconds) / 60.0, 1)),
            "ai_recommendations": recommendations
        }

monitoring_service = MonitoringService()
