from typing import Dict, List, Any
from alloy_api.models import Alloy, AlloyComposition

class AlloyService:
    """Service to load and query standard alloys from PostgreSQL database tables"""

    def get_all_alloys(self) -> List[Dict[str, Any]]:
        """Return all master alloys in the database"""
        alloys = Alloy.objects.all().prefetch_related('compositions')
        records = []
        for alloy in alloys:
            records.append(self._format_model(alloy))
        return records

    def get_alloy_by_grade(self, grade: str) -> Dict[str, Any]:
        """Query specific alloy standard by its grade/code string"""
        try:
            alloy = Alloy.objects.prefetch_related('compositions').get(code__iexact=grade)
            return self._format_model(alloy)
        except Alloy.DoesNotExist:
            # Fallback check by name search
            alloy = Alloy.objects.prefetch_related('compositions').filter(name__icontains=grade).first()
            if alloy:
                return self._format_model(alloy)
            return {}

    def _format_model(self, alloy: Alloy) -> Dict[str, Any]:
        target_composition = {}
        composition_limits = {}
        for comp in alloy.compositions.all():
            target_composition[comp.element] = comp.target_pct
            composition_limits[comp.element] = [comp.min_pct, comp.max_pct]

        return {
            "id": str(alloy.id),
            "Alloy Name": alloy.name,
            "Grade": alloy.code,
            "Standard": alloy.standard,
            "Density": alloy.density,
            "Melting Point": alloy.melting_point_max,  # max represents Liquidus limit
            "Target Chemical Composition": target_composition,
            "Mechanical Properties": alloy.mechanical_properties,
            "Typical Applications": alloy.typical_applications,
            "Required Elements": list(target_composition.keys()),
            "Composition Limits": composition_limits
        }

alloy_service = AlloyService()
