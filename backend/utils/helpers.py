from datetime import datetime

def format_timestamp(dt: datetime) -> str:
    """Format datetime objects consistently for API JSON payloads"""
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

def round_value(val: float, decimals: int = 2) -> float:
    """Safely round numbers handling None values"""
    if val is None:
        return 0.0
    return round(float(val), decimals)
