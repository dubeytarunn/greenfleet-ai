"""
GreenFlow AI - Sequential Vehicle Telemetry Generator
Generates realistic, physics-grounded time-series telemetry with 6 distinct labeled behavior scenarios:
1. normal: Smooth eco-driving in optimal gear and operating range
2. excessive_revving: High engine RPM (>3200 Diesel / >4500 Petrol) without matching speed
3. harsh_acceleration: Rapid throttle application with acceleration > 2.5 m/s^2
4. downhill_acceleration: Accelerating and burning fuel while descending steep negative slope
5. inefficient_gear: Lugging engine (low gear at speed, or high gear under heavy climb)
6. excessive_idling: Vehicle stationary (speed=0) with engine running for prolonged duration (>45s)
"""

import os
import sys
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import VEHICLE_PROFILES, BEHAVIOR_THRESHOLDS

BEHAVIOR_SCENARIOS = [
    "normal",
    "excessive_revving",
    "harsh_acceleration",
    "downhill_acceleration",
    "inefficient_gear",
    "excessive_idling",
]

TELEMETRY_COLUMNS = [
    "vehicle_id",
    "timestamp",
    "vehicle_type",
    "vehicle_age_years",
    "engine_size_l",
    "vehicle_weight_kg",
    "fuel_type",
    "latitude",
    "longitude",
    "speed_kmph",
    "acceleration_mps2",
    "rpm",
    "gear",
    "throttle_position_pct",
    "brake_pressure_pct",
    "engine_load_pct",
    "road_slope_pct",
    "road_type",
    "traffic_level",
    "ambient_temperature_c",
    "distance_travelled_km",
    "idle_duration_sec",
    "fuel_level_l",
    "fuel_rate_lph",
    "fuel_consumption_l_100km",
    "behavior_label",
]

# Baseline consumption rates (L/100km at 65 km/h cruise, flat terrain)
BASE_CRUISE_RATES: Dict[str, float] = {
    "Van": 8.5,
    "Light Commercial": 12.5,
    "Truck": 24.0,
    "Semi-Trailer": 32.0,
    "Bus": 26.0,
}

FUEL_TYPE_MULTIPLIERS: Dict[str, float] = {
    "Diesel": 1.0,
    "Petrol": 1.15,
    "Hybrid": 0.72,
    "CNG": 1.10,
    "Electric": 0.60,
}


def _get_optimal_gear(speed_kmph: float, vehicle_type: str) -> int:
    """Computes expected optimal gear for given speed."""
    if speed_kmph < 1.0:
        return 0  # Neutral / Idle
    if vehicle_type in ["Truck", "Semi-Trailer"]:
        # Heavy commercial vehicles: 8-12 speed transmission
        if speed_kmph < 12: return 1
        elif speed_kmph < 22: return 2
        elif speed_kmph < 32: return 3
        elif speed_kmph < 44: return 4
        elif speed_kmph < 56: return 5
        elif speed_kmph < 68: return 6
        elif speed_kmph < 80: return 7
        else: return 8
    else:
        # Standard 5/6 speed transmission
        if speed_kmph < 18: return 1
        elif speed_kmph < 35: return 2
        elif speed_kmph < 52: return 3
        elif speed_kmph < 70: return 4
        elif speed_kmph < 88: return 5
        else: return 6


def _compute_rpm(speed_kmph: float, gear: int, vehicle_type: str, behavior: str, rng: np.random.Generator) -> float:
    """Calculates realistic engine RPM based on speed, gear, vehicle type and behavior."""
    profile = VEHICLE_PROFILES.get(vehicle_type, VEHICLE_PROFILES["Truck"])
    idle_rpm = 700.0 if profile["engine_size_l"] > 5.0 else 850.0

    if speed_kmph < 1.0 or gear == 0:
        if behavior == "excessive_revving":
            return float(rng.uniform(3200, profile["redline_rpm"] - 200))
        return float(idle_rpm + rng.normal(0, 20))

    # Base gear ratio curve
    gear_ratio_factor = 280.0 / max(1, gear)
    base_rpm = idle_rpm + (speed_kmph * gear_ratio_factor * (3.5 / profile["engine_size_l"]))

    if behavior == "excessive_revving":
        base_rpm = max(base_rpm, profile["max_efficient_rpm"] + rng.uniform(800, 1400))
    elif behavior == "inefficient_gear":
        # Wrong gear: either under-geared (screaming RPM) or lugging (very low RPM)
        if rng.random() > 0.5:
            base_rpm = profile["max_efficient_rpm"] + 700
        else:
            base_rpm = max(idle_rpm + 50, base_rpm * 0.6)

    return float(np.clip(base_rpm + rng.normal(0, 30), idle_rpm, profile["redline_rpm"]))


def generate_vehicle_trip_telemetry(
    vehicle_id: str,
    vehicle_type: str,
    fuel_type: str,
    vehicle_age_years: int,
    trip_duration_sec: int = 300,
    forced_scenario: Optional[str] = None,
    start_time: Optional[datetime] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generates a continuous 1Hz time-series telemetry trajectory for a single vehicle trip.
    """
    rng = np.random.default_rng(seed)
    profile = VEHICLE_PROFILES.get(vehicle_type, VEHICLE_PROFILES["Truck"])
    start_dt = start_time or datetime(2026, 8, 22, 8, 0, 0)

    # Initial trip conditions
    lat = 19.0760 + rng.uniform(-0.05, 0.05)
    lon = 72.8777 + rng.uniform(-0.05, 0.05)
    cargo_load_kg = rng.uniform(0.2, 0.9) * profile["max_payload_kg"]
    total_weight_kg = profile["curb_weight_kg"] + cargo_load_kg
    fuel_capacity = profile["fuel_capacity_l"]
    current_fuel_l = rng.uniform(0.35, 0.95) * fuel_capacity

    road_types = ["Highway", "Urban", "Rural", "Mountain"]
    road_type = rng.choice(road_types, p=[0.45, 0.35, 0.12, 0.08])
    traffic_levels = ["Low", "Medium", "High", "Gridlock"]
    traffic_level = rng.choice(traffic_levels, p=[0.40, 0.35, 0.20, 0.05])

    traffic_speed_caps = {"Low": 90.0, "Medium": 65.0, "High": 35.0, "Gridlock": 12.0}
    max_target_speed = traffic_speed_caps[traffic_level]

    # Pre-select scenario duration windows if forced_scenario is given
    scenario = forced_scenario or "normal"

    records: List[Dict[str, Any]] = []
    current_speed = 0.0 if scenario == "excessive_idling" else float(rng.uniform(15.0, 45.0))
    distance_accum_km = 0.0
    consecutive_idle_sec = 0

    base_l_100km = BASE_CRUISE_RATES[vehicle_type] * FUEL_TYPE_MULTIPLIERS.get(fuel_type, 1.0)
    # Weight penalty: +30% at max capacity
    weight_factor = 1.0 + (0.30 * (cargo_load_kg / max(1.0, profile["max_payload_kg"])))
    # Age wear: +1.2% per year
    age_factor = 1.0 + (0.012 * vehicle_age_years)

    for step in range(trip_duration_sec):
        current_time = start_dt + timedelta(seconds=step)

        # Environmental & Road dynamics
        if road_type == "Mountain":
            road_slope = float(np.sin(step / 35.0) * 5.5)
        elif road_type == "Highway":
            road_slope = float(rng.normal(0.0, 0.8))
        else:
            road_slope = float(rng.normal(0.0, 1.2))

        # Behavior-specific dynamics
        active_behavior = scenario

        if active_behavior == "excessive_idling":
            current_speed = 0.0
            accel = 0.0
            gear = 0
            throttle_pct = 0.0
            brake_pct = float(rng.uniform(30.0, 60.0))
            consecutive_idle_sec += 1
            rpm = float(profile["engine_size_l"] * 100 + 700 + rng.normal(0, 15))
            engine_load_pct = float(rng.uniform(12.0, 18.0))
            
            # Idling fuel rate: liters per hour
            fuel_rate_lph = float(profile["idle_fuel_rate_lph"] * age_factor * (1.0 + rng.normal(0, 0.03)))
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = 99.9  # Zero distance division indicator

        elif active_behavior == "harsh_acceleration":
            consecutive_idle_sec = 0
            accel = float(rng.uniform(2.6, 4.2))
            current_speed = min(max_target_speed + 15, current_speed + (accel * 3.6))
            gear = max(1, _get_optimal_gear(current_speed, vehicle_type) - 1)
            throttle_pct = float(rng.uniform(85.0, 100.0))
            brake_pct = 0.0
            rpm = _compute_rpm(current_speed, gear, vehicle_type, active_behavior, rng)
            engine_load_pct = float(rng.uniform(88.0, 100.0))

            speed_factor = 1.0 + (BEHAVIOR_THRESHOLDS["speed_drag_coefficient"] * ((current_speed - 65.0) ** 2))
            inst_rate = (base_l_100km * weight_factor * age_factor * speed_factor * 1.85)  # Harsh acceleration surge
            fuel_rate_lph = max(0.5, (inst_rate / 100.0) * current_speed)
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = inst_rate

        elif active_behavior == "downhill_acceleration":
            consecutive_idle_sec = 0
            road_slope = float(rng.uniform(-4.5, -2.2))  # Steep downhill
            accel = float(rng.uniform(0.6, 1.8))          # Positive acceleration downhill instead of coasting
            current_speed = min(95.0, current_speed + (accel * 3.6))
            gear = _get_optimal_gear(current_speed, vehicle_type)
            throttle_pct = float(rng.uniform(45.0, 75.0)) # Unnecessary throttle on descent
            brake_pct = 0.0
            rpm = _compute_rpm(current_speed, gear, vehicle_type, active_behavior, rng)
            engine_load_pct = float(rng.uniform(40.0, 65.0))

            # Fuel burned while descending actively instead of coasting at 0 L/100km
            inst_rate = base_l_100km * weight_factor * age_factor * 0.95
            fuel_rate_lph = max(0.5, (inst_rate / 100.0) * current_speed)
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = inst_rate

        elif active_behavior == "excessive_revving":
            consecutive_idle_sec = 0
            accel = float(rng.normal(0.0, 0.3))
            current_speed = float(np.clip(current_speed + (accel * 3.6), 20.0, 60.0))
            # Trapped in very low gear
            gear = 1 if current_speed < 35 else 2
            throttle_pct = float(rng.uniform(65.0, 90.0))
            brake_pct = 0.0
            rpm = _compute_rpm(current_speed, gear, vehicle_type, active_behavior, rng)
            engine_load_pct = float(rng.uniform(70.0, 90.0))

            rev_penalty = 1.0 + (0.0006 * max(0, rpm - profile["max_efficient_rpm"]))
            inst_rate = base_l_100km * weight_factor * age_factor * rev_penalty * 1.55
            fuel_rate_lph = max(0.5, (inst_rate / 100.0) * current_speed)
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = inst_rate

        elif active_behavior == "inefficient_gear":
            consecutive_idle_sec = 0
            accel = float(rng.normal(0.1, 0.2))
            current_speed = float(np.clip(current_speed + (accel * 3.6), 25.0, 75.0))
            # Inappropriate gear (e.g. 5th gear at 25km/h uphill or 2nd gear at 60km/h)
            gear = 5 if current_speed < 40 else 2
            throttle_pct = float(rng.uniform(55.0, 80.0))
            brake_pct = 0.0
            rpm = _compute_rpm(current_speed, gear, vehicle_type, active_behavior, rng)
            engine_load_pct = float(rng.uniform(75.0, 92.0))

            inst_rate = base_l_100km * weight_factor * age_factor * 1.35
            fuel_rate_lph = max(0.5, (inst_rate / 100.0) * current_speed)
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = inst_rate

        else:  # "normal" eco driving
            consecutive_idle_sec = 0
            speed_high = max(15.0, min(80.0, max_target_speed))
            speed_low = min(10.0, speed_high - 2.0)
            target_speed = float(rng.uniform(speed_low, speed_high))
            speed_error = target_speed - current_speed
            accel = float(np.clip(speed_error * 0.15 + rng.normal(0, 0.1), -1.2, 1.2))
            current_speed = float(np.clip(current_speed + (accel * 3.6), 0.0, 100.0))
            gear = _get_optimal_gear(current_speed, vehicle_type)
            throttle_pct = float(np.clip(max(0.0, accel * 25.0 + 20.0), 0.0, 55.0))
            brake_pct = float(np.clip(max(0.0, -accel * 30.0), 0.0, 70.0)) if accel < -0.3 else 0.0
            rpm = _compute_rpm(current_speed, gear, vehicle_type, "normal", rng)

            # Slope effect on engine load and fuel
            grade_mult = 1.0 + (0.075 * road_slope if road_slope >= 0 else max(-0.5, 0.04 * road_slope))
            engine_load_pct = float(np.clip(35.0 * grade_mult + (throttle_pct * 0.6), 15.0, 85.0))

            speed_factor = 1.0 + (BEHAVIOR_THRESHOLDS["speed_drag_coefficient"] * ((current_speed - 65.0) ** 2))
            inst_rate = base_l_100km * weight_factor * age_factor * speed_factor * grade_mult
            inst_rate = max(1.5, inst_rate * (1.0 + rng.normal(0, 0.02)))
            fuel_rate_lph = (inst_rate / 100.0) * current_speed if current_speed > 1.0 else profile["idle_fuel_rate_lph"]
            fuel_consumed_step_l = (fuel_rate_lph / 3600.0)
            l_100km = inst_rate if current_speed > 1.0 else 0.0

        # Update spatial coords & fuel tank
        dist_step_km = (current_speed / 3600.0)
        distance_accum_km += dist_step_km
        current_fuel_l = max(0.0, current_fuel_l - fuel_consumed_step_l)

        lat += (current_speed * 0.0000025)
        lon += (current_speed * 0.0000020)

        record = {
            "vehicle_id": vehicle_id,
            "timestamp": current_time.isoformat(),
            "vehicle_type": vehicle_type,
            "vehicle_age_years": int(vehicle_age_years),
            "engine_size_l": round(float(profile["engine_size_l"]), 1),
            "vehicle_weight_kg": round(float(total_weight_kg), 1),
            "fuel_type": fuel_type,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "speed_kmph": round(float(current_speed), 1),
            "acceleration_mps2": round(float(accel), 2),
            "rpm": round(float(rpm), 0),
            "gear": int(gear),
            "throttle_position_pct": round(float(throttle_pct), 1),
            "brake_pressure_pct": round(float(brake_pct), 1),
            "engine_load_pct": round(float(engine_load_pct), 1),
            "road_slope_pct": round(float(road_slope), 2),
            "road_type": road_type,
            "traffic_level": traffic_level,
            "ambient_temperature_c": round(float(28.0 + rng.normal(0, 1.5)), 1),
            "distance_travelled_km": round(float(distance_accum_km), 3),
            "idle_duration_sec": int(consecutive_idle_sec),
            "fuel_level_l": round(float(current_fuel_l), 2),
            "fuel_rate_lph": round(float(fuel_rate_lph), 2),
            "fuel_consumption_l_100km": round(float(l_100km), 2),
            "behavior_label": active_behavior,
        }
        records.append(record)

    return pd.DataFrame(records)


def generate_telemetry_dataset(
    num_vehicles: int = 10,
    trips_per_vehicle: int = 3,
    samples_per_trip: int = 120,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generates a full multi-vehicle sequential telemetry dataset covering all 6 driving scenarios.
    """
    rng = np.random.default_rng(seed)
    vehicle_types = ["Van", "Light Commercial", "Truck", "Semi-Trailer", "Bus"]
    fuel_types = ["Diesel", "Petrol", "Hybrid", "CNG"]

    all_dfs = []
    base_date = datetime(2026, 8, 22, 8, 0, 0)

    for v_idx in range(1, num_vehicles + 1):
        v_id = f"V{v_idx:03d}"
        v_type = vehicle_types[(v_idx - 1) % len(vehicle_types)]
        f_type = "Diesel" if v_type in ["Truck", "Semi-Trailer"] else fuel_types[(v_idx - 1) % len(fuel_types)]
        v_age = int(rng.integers(1, 10))

        for t_idx in range(trips_per_vehicle):
            # Ensure every driving scenario is systematically generated and represented
            scenario_idx = (v_idx + t_idx) % len(BEHAVIOR_SCENARIOS)
            scenario = BEHAVIOR_SCENARIOS[scenario_idx]
            trip_start = base_date + timedelta(hours=t_idx * 2, minutes=v_idx * 10)

            df_trip = generate_vehicle_trip_telemetry(
                vehicle_id=v_id,
                vehicle_type=v_type,
                fuel_type=f_type,
                vehicle_age_years=v_age,
                trip_duration_sec=samples_per_trip,
                forced_scenario=scenario,
                start_time=trip_start,
                seed=seed + (v_idx * 100) + t_idx,
            )
            all_dfs.append(df_trip)

    combined_df = pd.concat(all_dfs, ignore_index=True)
    return combined_df


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic sequential telemetry for GreenFlow AI.")
    parser.add_argument("--vehicles", type=int, default=12, help="Number of vehicles (default: 12)")
    parser.add_argument("--trips", type=int, default=4, help="Trips per vehicle (default: 4)")
    parser.add_argument("--samples", type=int, default=150, help="Samples per trip in seconds (default: 150)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42)")
    parser.add_argument("--output", type=str, default=None, help="Output CSV path")

    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = args.output or os.path.join(script_dir, "..", "data", "raw", "synthetic_telemetry.csv")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"[GreenFlow ML] Generating sequential telemetry for {args.vehicles} vehicles ({args.trips} trips each, seed={args.seed})...")
    df = generate_telemetry_dataset(
        num_vehicles=args.vehicles,
        trips_per_vehicle=args.trips,
        samples_per_trip=args.samples,
        seed=args.seed,
    )
    df.to_csv(output_path, index=False)
    print(f"[GreenFlow ML] Saved synthetic telemetry dataset to: {output_path}")
    print(f"[GreenFlow ML] Telemetry rows: {len(df)}, columns: {df.shape[1]}")
    print("\nScenario distribution:")
    print(df["behavior_label"].value_counts())


if __name__ == "__main__":
    main()
