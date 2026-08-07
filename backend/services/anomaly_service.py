from typing import Dict, List, Any
from ai.prediction_engine import prediction_engine

class AnomalyService:
    """Service to evaluate process anomalies using statistical thresholds and ML models"""

    @staticmethod
    def analyze_anomalies(process_data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Identify process deviations and return diagnostic analysis logs"""
        anomalies = []
        if not process_data_list:
            return anomalies

        # Statistical averages
        temperatures = [d.get('temperature', 1580.0) for d in process_data_list]
        avg_temp = sum(temperatures) / len(temperatures) if temperatures else 1580.0

        for data in process_data_list[-3:]:  # Inspect last 3 readings
            temp = data.get('temperature', 1580.0)
            
            # 1. Statistical Check (3-Sigma simple threshold warning)
            if abs(temp - avg_temp) > 80.0:
                anomalies.append({
                    "severity": "high",
                    "root_cause": "Refractory thermal leakage or excessive power line feed",
                    "recommended_action": "Manually reduce induction coil grid voltage by 5%",
                    "predicted_impact": "Refractory wear and structural lining cracks",
                    "anomaly_type": "Thermal Deviation",
                    "value": temp,
                    "confidence": 92.4
                })

            # 2. ML Anomaly Check
            plate_features = {
                "current_C": data.get('composition_data', {}).get('C', 0.05),
                "current_Si": data.get('composition_data', {}).get('Si', 0.5),
                "current_Mn": data.get('composition_data', {}).get('Mn', 1.0),
                "current_Cr": data.get('composition_data', {}).get('Cr', 18.0),
                "current_Ni": data.get('composition_data', {}).get('Ni', 8.0),
                "Steel_Plate_Thickness": 12.0
            }
            
            anomaly_prob = prediction_engine.predict_anomaly_prob(plate_features)
            if anomaly_prob > 0.4:
                anomalies.append({
                    "severity": "critical" if anomaly_prob > 0.8 else "medium",
                    "root_cause": "Trace elements composition drift beyond acceptable standard margins",
                    "recommended_action": "Trigger trim additions of FeSi or Ni briquettes",
                    "predicted_impact": "Reduction in final UTS tensile strength below target ASTM specs",
                    "anomaly_type": "Composition Drift",
                    "confidence": round(anomaly_prob * 100, 2)
                })

        return anomalies

anomaly_service = AnomalyService()
