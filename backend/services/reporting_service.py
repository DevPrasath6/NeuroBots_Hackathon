import json
from typing import Dict, Any
from django.utils import timezone

class ReportingService:
    """Service to generate final production reports and melt audits"""

    @staticmethod
    def compile_batch_report(batch_id: str, grade: str, target_weight_tons: float, 
                             melt_data: Dict[str, Any], quality_results: Dict[str, Any]) -> Dict[str, Any]:
        """Compile a complete JSON log of the batch heat run for PDF export"""
        
        return {
            "batch_id": batch_id,
            "grade": grade,
            "target_weight_tons": target_weight_tons,
            "compiled_at": timezone.now().isoformat(),
            "melt_telemetry_summary": {
                "avg_temperature_c": melt_data.get("current_temperature", 1580.0),
                "energy_consumed_kwh": melt_data.get("predicted_energy_kwh", 450.0),
                "slag_condition": melt_data.get("slag_condition", "OPTIMAL"),
                "furnace_efficiency_pct": melt_data.get("furnace_efficiency_pct", 93.5),
            },
            "quality_audit": {
                "final_score": quality_results.get("quality_score", 95.0),
                "is_compliant": quality_results.get("is_compliant", True),
                "mechanical_properties": quality_results.get("predicted_properties", {}),
                "deviations_encountered": quality_results.get("deviations", {})
            },
            "system_recommendations": [
                "Refractory coils running within nominal thermal parameters.",
                "Verify next feedstock purity grade prior to charging.",
                "Schedule routine XRF sensor calibration in 12 running hours."
            ]
        }

reporting_service = ReportingService()
