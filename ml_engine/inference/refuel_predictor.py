"""
GreenFlow AI - Remaining Range & Refuel Urgency Predictor
Estimates remaining drivable range (km), time to refuel, and refuel warning states.
"""

import os
import sys
from typing import Dict, Any, Optional
import numpy as np

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import VEHICLE_PROFILES


def estimate_remaining_range(
    fuel_level_l: float,
    expected_efficiency_kmpl: float,
    current_efficiency_kmpl: Optional[float] = None,
    vehicle_type: str = "Truck",
    fuel_capacity_l: Optional[float] = None,
    trip_remaining_distance_km: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Computes dynamic remaining range and refuel urgency:

    Guarantees:
    - estimated_range_km >= 0.0
    - fuel_level_l >= 0.0

    Returns:
    {
        "fuel_level_l": float,
        "fuel_level_pct": float,
        "estimated_range_km": float,
        "estimated_time_to_refuel_hours": Optional[float],
        "refuel_required": bool,
        "refuel_warning": Optional[str]
    }
    """
    profile = VEHICLE_PROFILES.get(vehicle_type, VEHICLE_PROFILES["Truck"])
    capacity = fuel_capacity_l or profile.get("fuel_capacity_l", 200.0)
    current_fuel = max(0.0, float(fuel_level_l))
    fuel_pct = min(100.0, (current_fuel / max(1.0, capacity)) * 100.0)

    # Blended efficiency: 70% expected baseline + 30% recent driving behavior
    base_kmpl = max(0.5, float(expected_efficiency_kmpl))
    if current_efficiency_kmpl is not None and current_efficiency_kmpl > 0:
        blended_kmpl = (0.70 * base_kmpl) + (0.30 * min(base_kmpl * 1.5, current_efficiency_kmpl))
    else:
        blended_kmpl = base_kmpl

    estimated_range = max(0.0, current_fuel * blended_kmpl)

    # Refuel warning evaluation
    refuel_required = False
    refuel_warning = None

    if fuel_pct <= 10.0 or estimated_range < 30.0:
        refuel_required = True
        refuel_warning = f"CRITICAL: Fuel critically low ({current_fuel:.1f} L, ~{estimated_range:.1f} km range remaining). Refuel immediately."
    elif fuel_pct <= 18.0 or estimated_range < 65.0:
        refuel_required = True
        refuel_warning = f"WARNING: Low fuel level ({current_fuel:.1f} L, ~{estimated_range:.1f} km range). Schedule refuel soon."
    elif trip_remaining_distance_km is not None and estimated_range < (trip_remaining_distance_km * 1.15):
        refuel_required = True
        refuel_warning = f"CAUTION: Remaining range ({estimated_range:.1f} km) insufficient for remaining route ({trip_remaining_distance_km:.1f} km)."

    return {
        "fuel_level_l": round(current_fuel, 1),
        "fuel_level_pct": round(fuel_pct, 1),
        "estimated_range_km": round(estimated_range, 1),
        "blended_efficiency_kmpl": round(blended_kmpl, 2),
        "refuel_required": refuel_required,
        "refuel_warning": refuel_warning,
    }
