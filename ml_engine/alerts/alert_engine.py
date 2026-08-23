"""
GreenFlow AI - Central Driver Alert & Efficiency Engine
Provides stateful debouncing, severity escalation, waste estimation, and driver coaching alerts.
"""

import os
import sys
import time
from typing import Dict, Any, List, Union, Optional
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import ALERT_SETTINGS, BEHAVIOR_THRESHOLDS
from inference.fuel_predictor import predict_fuel_consumption
from inference.behavior_detector import BehaviorDetector
from inference.fuel_waste_estimator import estimate_fuel_waste
from inference.refuel_predictor import estimate_remaining_range


class AlertEngine:
    """
    Stateful alert processor with debouncing, persistence tracking, and escalation.
    """

    def __init__(self):
        self.detector = BehaviorDetector(window_size_sec=ALERT_SETTINGS["rolling_window_seconds"])
        # In-memory vehicle state tracking: { vehicle_id: { last_behavior, state_duration_sec, last_alert_time, current_severity } }
        self._vehicle_states: Dict[str, Dict[str, Any]] = {}

    def process(
        self,
        telemetry_window: Union[Dict[str, Any], List[Dict[str, Any]], pd.DataFrame],
        fuel_price_inr: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Processes a telemetry stream window, assesses behavior, calculates fuel waste,
        evaluates remaining range, and generates an actionable alert payload.
        """
        if isinstance(telemetry_window, dict):
            records = [telemetry_window]
        elif isinstance(telemetry_window, pd.DataFrame):
            records = telemetry_window.to_dict(orient="records")
        else:
            records = telemetry_window

        if not records:
            return {
                "vehicle_id": "UNKNOWN",
                "behaviour": "normal",
                "severity": "NORMAL",
                "behaviour_score": 100.0,
                "fuel_deviation_pct": 0.0,
                "fuel_wasted_l": 0.0,
                "estimated_cost_inr": 0.0,
                "co2_impact_kg": 0.0,
                "remaining_range_km": 0.0,
                "refuel_required": False,
                "message": "No active telemetry received.",
            }

        latest_record = records[-1]
        vehicle_id = str(latest_record.get("vehicle_id", "V_UNKNOWN"))
        v_type = str(latest_record.get("vehicle_type", "Truck"))
        fuel_level = float(latest_record.get("fuel_level_l", 50.0))

        # 1. Expected ML Fuel Consumption Baseline
        expected_metrics = predict_fuel_consumption(latest_record)

        # 2. Driving Behavior Detection
        behavior_result = self.detector.analyze_window(records)
        detected_behavior = behavior_result["detected_behavior"]
        base_severity = behavior_result["severity"]
        behavior_score = behavior_result["behavior_score"]
        detail_msg = behavior_result["detail"]

        # 3. Fuel Waste & Cost / CO2 Impact
        waste_result = estimate_fuel_waste(records, expected_metrics=expected_metrics, fuel_price_inr=fuel_price_inr)
        fuel_deviation_pct = waste_result["fuel_deviation_pct"]
        fuel_wasted_l = waste_result["fuel_wasted_l"]
        cost_inr = waste_result["estimated_cost_inr"]
        co2_kg = waste_result["co2_emissions_kg"]

        # 4. Remaining Range Estimation
        expected_kmpl = expected_metrics.get("expected_efficiency_kmpl", 4.0)
        range_result = estimate_remaining_range(
            fuel_level_l=fuel_level,
            expected_efficiency_kmpl=expected_kmpl,
            vehicle_type=v_type,
        )
        remaining_range_km = range_result["estimated_range_km"]
        refuel_required = range_result["refuel_required"]

        # 5. Stateful Escalation & Debouncing Logic
        state = self._vehicle_states.get(vehicle_id, {
            "last_behavior": "normal",
            "consecutive_count": 0,
            "severity": "NORMAL",
        })

        if detected_behavior == "normal":
            state["consecutive_count"] = 0
            state["last_behavior"] = "normal"
            state["severity"] = "NORMAL"
            final_severity = "NORMAL"
            message = "Optimal driving behavior. Fuel consumption within expected baseline."
        else:
            if state["last_behavior"] == detected_behavior:
                state["consecutive_count"] += len(records)
            else:
                state["consecutive_count"] = len(records)
                state["last_behavior"] = detected_behavior

            # Escalation based on persistence and deviation %
            duration = state["consecutive_count"]

            if duration >= 60 or fuel_deviation_pct >= BEHAVIOR_THRESHOLDS["fuel_deviation_critical_pct"] or cost_inr >= 25.0:
                final_severity = "CRITICAL"
                message = f"CRITICAL: Sustained {detected_behavior.replace('_', ' ').title()} ({detail_msg}). Fuel waste: {fuel_wasted_l:.3f} L (₹{cost_inr:.2f}, +{fuel_deviation_pct:.1f}% deviation)."
            elif duration >= 25 or fuel_deviation_pct >= BEHAVIOR_THRESHOLDS["fuel_deviation_warning_pct"] or cost_inr >= 8.0:
                final_severity = "WARNING"
                message = f"WARNING: Persistent {detected_behavior.replace('_', ' ').title()} ({detail_msg}). Additional fuel: {fuel_wasted_l:.3f} L (₹{cost_inr:.2f})."
            else:
                final_severity = "INFO"
                message = f"INFO: Efficiency opportunity: {detected_behavior.replace('_', ' ')} detected ({detail_msg})."

            state["severity"] = final_severity

        self._vehicle_states[vehicle_id] = state

        # If refuel is critical, append refuel urgency
        if refuel_required and range_result.get("refuel_warning"):
            message = f"{range_result['refuel_warning']} | {message}"

        return {
            "vehicle_id": vehicle_id,
            "behaviour": detected_behavior,
            "severity": final_severity,
            "behaviour_score": behavior_score,
            "fuel_deviation_pct": fuel_deviation_pct,
            "fuel_wasted_l": fuel_wasted_l,
            "estimated_cost_inr": cost_inr,
            "co2_impact_kg": co2_kg,
            "remaining_range_km": remaining_range_km,
            "refuel_required": refuel_required,
            "message": message,
        }


# Singleton alert engine instance for lightweight zero-reinitialization inference
_GLOBAL_ALERT_ENGINE = AlertEngine()


def process_telemetry(
    telemetry_window: Union[Dict[str, Any], List[Dict[str, Any]], pd.DataFrame],
    fuel_price_inr: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Public functional interface to process vehicle telemetry stream:
    Returns standard GreenFlow alert dictionary.
    """
    return _GLOBAL_ALERT_ENGINE.process(telemetry_window, fuel_price_inr=fuel_price_inr)
