from typing import Dict, List
from utils.calculations import calculate_material_required
from ai.prediction_engine import prediction_engine

class RecommendationEngine:
    """Core engine for AI metallurgical additions trim recommendations"""

    @staticmethod
    def calculate_recommendations(target_composition: Dict[str, float],
                                  current_composition: Dict[str, float],
                                  batch_weight_tons: float = 100.0) -> List[Dict]:
        """
        Calculates optimal material additions deterministically,
        then evaluates confidence using the trained ML anomaly/quality models.
        """
        recommendations = []
        
        for element, target_val in target_composition.items():
            current_val = current_composition.get(element, 0.0)
            
            if target_val > current_val:
                deviation = target_val - current_val
                # Deterministic check
                material, quantity = calculate_material_required(element, deviation, batch_weight_tons)
                
                if quantity > 0:
                    # ML evaluation
                    # Build feature vector for quality prediction
                    plate_features = {
                        "current_C": current_composition.get("C", 0.0),
                        "current_Si": current_composition.get("Si", 0.0),
                        "current_Mn": current_composition.get("Mn", 0.0),
                        "current_Cr": current_composition.get("Cr", 0.0),
                        "current_Ni": current_composition.get("Ni", 0.0),
                        "current_Mo": current_composition.get("Mo", 0.0),
                        "Steel_Plate_Thickness": 12.0 # representative steel plate thickness
                    }
                    
                    # Estimate confidence using predicted probability of no anomalies
                    anomaly_prob = prediction_engine.predict_anomaly_prob(plate_features)
                    confidence = max(80.0, 100.0 - (anomaly_prob * 100.0))

                    recommendations.append({
                        'material': material,
                        'quantity': quantity,
                        'element': element,
                        'current': current_val,
                        'target': target_val,
                        'confidence': min(99.0, confidence)
                    })
                    
        return recommendations
