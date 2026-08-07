from typing import Dict, List, Any
from ai.recommendation_engine import RecommendationEngine
from services.quality_service import quality_service
from services.anomaly_service import anomaly_service

class AlloyOptimizer:
    """Legacy wrapper delegating to RecommendationEngine"""
    @staticmethod
    def calculate_alloy_recommendations(target_composition: Dict[str, float],
                                      current_composition: Dict[str, float],
                                      use_ml: bool = True) -> List[Dict]:
        recommendations = RecommendationEngine.calculate_recommendations(
            target_composition, current_composition, batch_weight_tons=100.0
        )
        # Format output to match old heuristic format
        formatted = []
        for rec in recommendations:
            formatted.append({
                'material': rec['material'],
                'quantity': rec['quantity'],
                'element': rec['element'],
                'current': rec['current'],
                'target': rec['target'],
                'confidence': rec['confidence']
            })
        return formatted

class QualityAnalyzer:
    """Legacy wrapper delegating to quality_service"""
    @staticmethod
    def calculate_quality_score(composition: Dict[str, float],
                               target_grade: str) -> float:
        res = quality_service.evaluate_batch_quality(target_grade, composition)
        return res.get('quality_score', 85.0)

class ProcessMonitor:
    """Legacy wrapper delegating to anomaly_service"""
    @staticmethod
    def detect_anomalies(recent_data: List[Any]) -> List[Dict]:
        recent_dicts = []
        for d in recent_data:
            # Handle both models and dict objects
            if hasattr(d, 'temperature'):
                recent_dicts.append({
                    'temperature': d.temperature,
                    'composition_data': d.composition_data,
                    'furnace_id': d.furnace_id,
                    'timestamp': d.timestamp
                })
            else:
                recent_dicts.append(d)
        return anomaly_service.analyze_anomalies(recent_dicts)
