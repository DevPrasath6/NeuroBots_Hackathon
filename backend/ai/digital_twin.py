import time
from typing import Dict, Any

class DigitalTwinSimulator:
    """Digital Twin simulator representing thermal and physical states of induction furnaces"""

    @staticmethod
    def get_live_metrics(furnace_id: str, elapsed_seconds: float) -> Dict[str, Any]:
        """Generate simulated Digital Twin telemetry based on elapsed time"""
        # Melting cycle is 78 minutes (4680 seconds)
        duration = 4680.0
        progress = min(100.0, (elapsed_seconds / duration) * 100.0)

        # Temperature curve: starts at 25°C, ramps up to 1580°C
        if progress < 20: # charging
            temp = 25 + (progress * 40)
            stage = "CHARGING SEQUENCE"
            power = 15.0
        elif progress < 80: # active melting
            temp = 825 + ((progress - 20) * 12.5)
            stage = "ACTIVE MELTING"
            power = 45.8
        else: # refining and alloy trimming
            temp = 1575 + ((progress - 80) * 0.25)
            stage = "ALLOY TRIMMING"
            power = 30.0

        return {
            "furnace_id": furnace_id,
            "stage": stage,
            "progress": round(progress, 1),
            "temperature": round(temp, 1),
            "power_draw": round(power, 1),
            "slag_condition": "OPTIMAL" if temp > 1400 else "CRUST_FORMING",
            "oxygen_level": round(max(0.01, 0.05 - (progress * 0.0004)), 4)
        }
