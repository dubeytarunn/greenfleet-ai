"""
GreenFlow AI - Real-Time Driving Behavior Detector
Analyzes rolling windows of vehicle telemetry using contextual rule evaluators
and baseline comparisons to detect driving inefficiencies.
"""

import os
import sys
from typing import Dict, Any, List, Union, Tuple, Optional
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import VEHICLE_PROFILES, BEHAVIOR_THRESHOLDS
from alerts.behavior_rules import (
    evaluate_excessive_revving,
    evaluate_harsh_acceleration,
    evaluate_downhill_acceleration,
    evaluate_inefficient_gear,
    evaluate_excessive_idling,
)


class BehaviorDetector:
    """
    Context-aware behavior analyzer operating on telemetry frames and rolling windows.
    """

    def __init__(self, window_size_sec: int = 15):
        self.window_size_sec = window_size_sec

    def analyze_frame(self, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluates instantaneous telemetry frame."""
        v_type = telemetry.get("vehicle_type", "Truck")
        profile = VEHICLE_PROFILES.get(v_type, VEHICLE_PROFILES["Truck"])

        # Check in order of behavioral specificity
        is_idle, idle_sev, idle_msg = evaluate_excessive_idling(telemetry)
        if is_idle:
            return {
                "behavior": "excessive_idling",
                "severity_score": idle_sev,
                "detail": idle_msg,
            }

        is_harsh, harsh_sev, harsh_msg = evaluate_harsh_acceleration(telemetry)
        if is_harsh:
            return {
                "behavior": "harsh_acceleration",
                "severity_score": harsh_sev,
                "detail": harsh_msg,
            }

        is_downhill, downhill_sev, downhill_msg = evaluate_downhill_acceleration(telemetry)
        if is_downhill:
            return {
                "behavior": "downhill_acceleration",
                "severity_score": downhill_sev,
                "detail": downhill_msg,
            }

        is_revving, rev_sev, rev_msg = evaluate_excessive_revving(telemetry, profile)
        if is_revving:
            return {
                "behavior": "excessive_revving",
                "severity_score": rev_sev,
                "detail": rev_msg,
            }

        is_gear, gear_sev, gear_msg = evaluate_inefficient_gear(telemetry, profile)
        if is_gear:
            return {
                "behavior": "inefficient_gear",
                "severity_score": gear_sev,
                "detail": gear_msg,
            }

        return {
            "behavior": "normal",
            "severity_score": 0.0,
            "detail": "Smooth and eco-efficient driving",
        }

    def analyze_window(
        self,
        telemetry_window: Union[List[Dict[str, Any]], pd.DataFrame],
    ) -> Dict[str, Any]:
        """
        Analyzes a rolling window of telemetry (5-30s) to determine sustained behavior,
        filtering out transient single-frame sensor anomalies.
        """
        if isinstance(telemetry_window, pd.DataFrame):
            records = telemetry_window.to_dict(orient="records")
        else:
            records = telemetry_window

        if not records:
            return {
                "detected_behavior": "normal",
                "severity": "NORMAL",
                "behavior_score": 100.0,
                "persistence_pct": 0.0,
                "detail": "No telemetry data available",
            }

        frame_results = [self.analyze_frame(r) for r in records]
        behaviors = [res["behavior"] for res in frame_results]
        severity_scores = [res["severity_score"] for res in frame_results]

        # Identify dominant behavior in the window
        unique_behaviors, counts = np.unique(behaviors, return_counts=True)
        dominant_idx = np.argmax(counts)
        dominant_behavior = unique_behaviors[dominant_idx]
        dominant_count = counts[dominant_idx]
        persistence_pct = (dominant_count / len(records)) * 100.0

        # If non-normal behavior is present for >= 40% of the window, classify as that inefficiency
        non_normal_behaviors = [b for b in behaviors if b != "normal"]
        if non_normal_behaviors:
            nn_unique, nn_counts = np.unique(non_normal_behaviors, return_counts=True)
            top_nn_idx = np.argmax(nn_counts)
            top_nn_behavior = nn_unique[top_nn_idx]
            top_nn_count = nn_counts[top_nn_idx]
            nn_persistence = (top_nn_count / len(records)) * 100.0

            if nn_persistence >= 35.0:
                dominant_behavior = top_nn_behavior
                persistence_pct = nn_persistence

        # Calculate composite behavioral efficiency score (0 - 100)
        mean_severity = float(np.mean(severity_scores))
        behavior_score = round(float(np.clip(100.0 - (mean_severity * 65.0) - (0.35 * (100 - persistence_pct) if dominant_behavior != "normal" else 0.0), 10.0, 100.0)), 1)

        # Map to discrete severity tier
        if dominant_behavior == "normal" or behavior_score >= 88.0:
            severity_tier = "NORMAL"
        elif behavior_score >= 70.0:
            severity_tier = "INFO"
        elif behavior_score >= 45.0:
            severity_tier = "WARNING"
        else:
            severity_tier = "CRITICAL"

        # Extract representative message detail
        details = [res["detail"] for res in frame_results if res["behavior"] == dominant_behavior]
        detail_msg = details[-1] if details else "Normal operation"

        return {
            "detected_behavior": dominant_behavior,
            "severity": severity_tier,
            "behavior_score": behavior_score,
            "persistence_pct": round(persistence_pct, 1),
            "detail": detail_msg,
        }
