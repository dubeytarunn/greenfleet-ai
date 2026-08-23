"""
GreenFlow AI - Behavioral Rule Definitions & Evaluators
Defines vehicle-context-aware rules for driving behavior evaluation:
- Excessive Revving
- Harsh Acceleration
- Downhill Acceleration
- Inefficient Gear Selection / Engine Lugging
- Excessive Idling
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from config import VEHICLE_PROFILES, BEHAVIOR_THRESHOLDS


def evaluate_excessive_revving(
    telemetry: Dict[str, Any],
    vehicle_profile: Dict[str, Any],
) -> Tuple[bool, float, str]:
    """
    Evaluates whether engine RPM is excessively high relative to vehicle type and speed.
    """
    rpm = float(telemetry.get("rpm", 0.0))
    speed = float(telemetry.get("speed_kmph", 0.0))
    gear = int(telemetry.get("gear", 1))
    max_efficient_rpm = vehicle_profile.get("max_efficient_rpm", 2400)
    redline_rpm = vehicle_profile.get("redline_rpm", 3800)

    # Contextual check: high RPM when stationary (neutral revving) or low gear
    if speed < 2.0 and rpm > 1800:
        severity_ratio = (rpm - 1800) / max(1.0, redline_rpm - 1800)
        return True, min(1.0, severity_ratio), f"Stationary engine revving at {int(rpm)} RPM"

    if rpm > max_efficient_rpm:
        # Check if RPM is disproportionate to speed
        excess = rpm - max_efficient_rpm
        severity_ratio = excess / max(1.0, redline_rpm - max_efficient_rpm)
        if severity_ratio > 0.25:
            return True, min(1.0, severity_ratio), f"High RPM ({int(rpm)}) for speed ({speed:.1f} km/h, Gear {gear})"

    return False, 0.0, "Normal RPM"


def evaluate_harsh_acceleration(
    telemetry: Dict[str, Any],
) -> Tuple[bool, float, str]:
    """
    Evaluates whether instantaneous acceleration exceeds safe/economical thresholds.
    """
    accel = float(telemetry.get("acceleration_mps2", 0.0))
    throttle = float(telemetry.get("throttle_position_pct", 0.0))
    threshold = BEHAVIOR_THRESHOLDS["harsh_acceleration_mps2"]

    if accel >= threshold or (throttle > 85.0 and accel > 2.0):
        severity = min(1.0, (accel - threshold) / 2.0 + 0.3)
        return True, severity, f"Harsh acceleration ({accel:.2f} m/s²)"

    return False, 0.0, "Smooth acceleration"


def evaluate_downhill_acceleration(
    telemetry: Dict[str, Any],
) -> Tuple[bool, float, str]:
    """
    Evaluates whether driver is aggressively accelerating downhill on steep grade
    instead of using engine braking and momentum.
    """
    slope = float(telemetry.get("road_slope_pct", 0.0))
    accel = float(telemetry.get("acceleration_mps2", 0.0))
    speed = float(telemetry.get("speed_kmph", 0.0))
    throttle = float(telemetry.get("throttle_position_pct", 0.0))

    slope_thresh = BEHAVIOR_THRESHOLDS["downhill_slope_pct"]
    min_speed = BEHAVIOR_THRESHOLDS["downhill_min_speed_kmph"]
    accel_thresh = BEHAVIOR_THRESHOLDS["downhill_accel_mps2"]

    if slope <= slope_thresh and speed >= min_speed and (accel >= accel_thresh or throttle > 40.0):
        severity = min(1.0, abs(slope / 5.0) * 0.5 + (throttle / 100.0) * 0.5)
        return True, severity, f"Active throttle ({throttle:.0f}%) on {slope:.1f}% descent"

    return False, 0.0, "Normal descent"


def evaluate_inefficient_gear(
    telemetry: Dict[str, Any],
    vehicle_profile: Dict[str, Any],
) -> Tuple[bool, float, str]:
    """
    Evaluates whether vehicle is operated in a suboptimal gear (lugging engine or under-geared).
    """
    speed = float(telemetry.get("speed_kmph", 0.0))
    rpm = float(telemetry.get("rpm", 0.0))
    gear = int(telemetry.get("gear", 1))
    load = float(telemetry.get("engine_load_pct", 0.0))

    if speed < 5.0 or gear <= 0:
        return False, 0.0, "Normal low speed"

    # Lugging: High gear, low speed, high engine load
    if gear >= 4 and speed < 30.0 and load > 70.0:
        return True, 0.7, f"Engine lugging in Gear {gear} at {speed:.1f} km/h (Load {load:.0f}%)"

    # Under-geared: High speed in low gear without accelerating
    if gear <= 2 and speed > 40.0:
        return True, 0.8, f"High speed ({speed:.1f} km/h) in low Gear {gear}"

    return False, 0.0, "Optimal gear selection"


def evaluate_excessive_idling(
    telemetry: Dict[str, Any],
) -> Tuple[bool, float, str]:
    """
    Evaluates whether vehicle is stationary with engine running for extended duration.
    """
    speed = float(telemetry.get("speed_kmph", 0.0))
    idle_sec = int(telemetry.get("idle_duration_sec", 0))
    min_idle = BEHAVIOR_THRESHOLDS["idle_min_duration_sec"]
    crit_idle = BEHAVIOR_THRESHOLDS["idle_critical_duration_sec"]

    if speed < 1.0 and idle_sec >= min_idle:
        severity = min(1.0, idle_sec / float(crit_idle))
        return True, severity, f"Excessive idle duration: {idle_sec}s (>{min_idle}s limit)"

    return False, 0.0, "Not idling excessively"
