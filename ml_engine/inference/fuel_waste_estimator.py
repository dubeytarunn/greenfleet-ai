"""
GreenFlow AI - Fuel Waste & Environmental Impact Estimator
Calculates fuel deviation %, wasted fuel volume in litres, financial cost in INR,
and CO2 emissions impact relative to the LightGBM expected fuel consumption baseline.
"""

import os
import sys
from typing import Dict, Any, Union, List, Optional
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import (
    EMISSION_FACTORS_KG_CO2_PER_UNIT,
    FUEL_PRICES_INR_PER_UNIT,
    VEHICLE_PROFILES,
)
from inference.fuel_predictor import predict_fuel_consumption


def calculate_fuel_deviation_pct(actual_fuel: float, expected_fuel: float) -> float:
    """
    Calculates percentage deviation of actual fuel consumption above/below expected baseline:
    Formula: ((actual - expected) / expected) * 100
    """
    if expected_fuel <= 0.001:
        return 0.0
    deviation = ((float(actual_fuel) - float(expected_fuel)) / float(expected_fuel)) * 100.0
    return round(float(deviation), 1)


def estimate_fuel_waste(
    telemetry_window: Union[Dict[str, Any], List[Dict[str, Any]], pd.DataFrame],
    expected_metrics: Optional[Dict[str, Any]] = None,
    fuel_price_inr: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Evaluates excess fuel consumption, economic waste, and carbon footprint for a telemetry window.

    Guarantees:
    - fuel_wasted_l >= 0.0
    - estimated_cost_inr >= 0.0
    - co2_emissions_kg >= 0.0

    Returns:
    {
        "actual_fuel_rate_lph": float,
        "expected_fuel_rate_lph": float,
        "fuel_deviation_pct": float,
        "fuel_wasted_l": float,
        "estimated_cost_inr": float,
        "co2_emissions_kg": float,
        "window_duration_sec": int,
        "distance_travelled_km": float,
        "is_wasting_fuel": bool
    }
    """
    if isinstance(telemetry_window, dict):
        records = [telemetry_window]
    elif isinstance(telemetry_window, pd.DataFrame):
        records = telemetry_window.to_dict(orient="records")
    else:
        records = telemetry_window

    if not records:
        return {
            "actual_fuel_rate_lph": 0.0,
            "expected_fuel_rate_lph": 0.0,
            "fuel_deviation_pct": 0.0,
            "fuel_wasted_l": 0.0,
            "estimated_cost_inr": 0.0,
            "co2_emissions_kg": 0.0,
            "window_duration_sec": 0,
            "distance_travelled_km": 0.0,
            "is_wasting_fuel": False,
        }

    latest = records[-1]
    fuel_type = latest.get("fuel_type", "Diesel")
    price_per_l = fuel_price_inr if fuel_price_inr is not None else FUEL_PRICES_INR_PER_UNIT.get(fuel_type, 90.0)
    emission_factor = EMISSION_FACTORS_KG_CO2_PER_UNIT.get(fuel_type, 2.65)

    # Get ML-predicted expected baseline if not supplied
    if expected_metrics is None:
        expected_metrics = predict_fuel_consumption(latest)

    expected_lph = max(0.1, float(expected_metrics.get("expected_fuel_rate_lph", 1.0)))

    # Compute actual fuel rate from telemetry (fallback to expected if unspecified or None)
    actual_lph_list = [
        float(r["fuel_rate_lph"]) if r.get("fuel_rate_lph") is not None else expected_lph
        for r in records
    ]
    actual_lph = float(np.mean(actual_lph_list))


    # Calculate deviation %
    deviation_pct = calculate_fuel_deviation_pct(actual_lph, expected_lph)

    # Window duration in seconds (assuming 1Hz if N records)
    window_duration_sec = max(1, len(records))

    # Wasted litres over the window duration: (excess L/hr) * (hours in window)
    excess_lph = max(0.0, actual_lph - expected_lph)
    wasted_l = (excess_lph * window_duration_sec) / 3600.0
    wasted_l = max(0.0, wasted_l)

    # Calculate financial cost in INR and CO2 in kg
    cost_inr = max(0.0, wasted_l * price_per_l)
    co2_kg = max(0.0, wasted_l * emission_factor)

    # Distance covered in window
    speeds = [float(r.get("speed_kmph", 0.0)) for r in records]
    avg_speed = float(np.mean(speeds))
    distance_km = (avg_speed * window_duration_sec) / 3600.0

    return {
        "actual_fuel_rate_lph": round(actual_lph, 2),
        "expected_fuel_rate_lph": round(expected_lph, 2),
        "fuel_deviation_pct": deviation_pct,
        "fuel_wasted_l": round(float(wasted_l), 4),
        "estimated_cost_inr": round(float(cost_inr), 2),
        "co2_emissions_kg": round(float(co2_kg), 3),
        "window_duration_sec": window_duration_sec,
        "distance_travelled_km": round(float(distance_km), 3),
        "is_wasting_fuel": deviation_pct > 12.0 and wasted_l > 0.0,
    }
