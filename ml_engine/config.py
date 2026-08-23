"""
GreenFlow AI - Central ML & Intelligence Configuration
Defines physical constants, emission factors, fuel prices, vehicle profiles,
and behavioral detection thresholds.
"""

from typing import Dict, Any

# ---------------------------------------------------------------------------
# 1. EMISSION FACTORS (kg CO2 per unit of fuel/energy)
# Sources: DEFRA / UK Gov GHG Conversion Factors, US EPA Fleet Standards
# ---------------------------------------------------------------------------
EMISSION_FACTORS_KG_CO2_PER_UNIT: Dict[str, float] = {
    "Diesel": 2.68,     # kg CO2 / Litre
    "Petrol": 2.31,     # kg CO2 / Litre
    "Hybrid": 1.85,     # kg CO2 / Litre (accounting for regenerative powertrain)
    "CNG": 1.95,        # kg CO2 / kg or equivalent
    "Electric": 0.45,   # kg CO2 / kWh (grid average benchmark)
    "Default": 2.65,    # kg CO2 / Litre blended
}

# ---------------------------------------------------------------------------
# 2. FUEL PRICES (in INR ₹ per unit)
# Configurable economic assumptions for fleet cost waste calculations
# ---------------------------------------------------------------------------
FUEL_PRICES_INR_PER_UNIT: Dict[str, float] = {
    "Diesel": 95.00,    # ₹ / Litre (canonical operational baseline)
    "Petrol": 102.00,   # ₹ / Litre
    "Hybrid": 102.00,   # ₹ / Litre (petrol blend)
    "CNG": 85.00,       # ₹ / kg
    "Electric": 9.00,   # ₹ / kWh
    "Default": 95.00,   # ₹ / Litre
}

# ---------------------------------------------------------------------------
# 3. VEHICLE PROFILE BASELINES & PHYSICAL CONSTRAINTS
# ---------------------------------------------------------------------------
VEHICLE_PROFILES: Dict[str, Dict[str, Any]] = {
    "Van": {
        "engine_size_l": 2.0,
        "curb_weight_kg": 2100.0,
        "max_payload_kg": 1500.0,
        "fuel_capacity_l": 75.0,
        "idle_fuel_rate_lph": 0.8,
        "optimal_speed_kmph": 65.0,
        "max_efficient_rpm": 2800,
        "redline_rpm": 4500,
    },
    "Light Commercial": {
        "engine_size_l": 2.8,
        "curb_weight_kg": 3200.0,
        "max_payload_kg": 3500.0,
        "fuel_capacity_l": 100.0,
        "idle_fuel_rate_lph": 1.2,
        "optimal_speed_kmph": 60.0,
        "max_efficient_rpm": 2600,
        "redline_rpm": 4000,
    },
    "Truck": {
        "engine_size_l": 6.7,
        "curb_weight_kg": 7500.0,
        "max_payload_kg": 10000.0,
        "fuel_capacity_l": 240.0,
        "idle_fuel_rate_lph": 2.5,
        "optimal_speed_kmph": 55.0,
        "max_efficient_rpm": 2200,
        "redline_rpm": 3200,
    },
    "Semi-Trailer": {
        "engine_size_l": 12.8,
        "curb_weight_kg": 14000.0,
        "max_payload_kg": 26000.0,
        "fuel_capacity_l": 450.0,
        "idle_fuel_rate_lph": 3.8,
        "optimal_speed_kmph": 55.0,
        "max_efficient_rpm": 1900,
        "redline_rpm": 2800,
    },
    "Bus": {
        "engine_size_l": 7.2,
        "curb_weight_kg": 9500.0,
        "max_payload_kg": 6000.0,
        "fuel_capacity_l": 280.0,
        "idle_fuel_rate_lph": 2.8,
        "optimal_speed_kmph": 50.0,
        "max_efficient_rpm": 2100,
        "redline_rpm": 3000,
    },
}

# ---------------------------------------------------------------------------
# 4. DRIVING BEHAVIOUR THRESHOLDS & HEURISTICS
# ---------------------------------------------------------------------------
BEHAVIOR_THRESHOLDS = {
    # Harsh acceleration threshold in m/s^2 (approx 0.28g)
    "harsh_acceleration_mps2": 2.5,
    "extreme_acceleration_mps2": 3.8,

    # Harsh braking threshold in m/s^2
    "harsh_braking_mps2": -3.5,

    # Downhill acceleration thresholds
    "downhill_slope_pct": -1.8,         # Road grade slope <= -1.8%
    "downhill_min_speed_kmph": 25.0,     # Vehicle moving at descent speed
    "downhill_accel_mps2": 0.5,          # Accelerating downhill instead of coasting/braking

    # Excessive idling thresholds
    "idle_min_duration_sec": 45,        # 45 seconds of continuous idle triggers warning
    "idle_critical_duration_sec": 180,  # 3 minutes of continuous idle triggers critical

    # Speed efficiency curve
    "optimal_speed_kmph": 65.0,
    "speed_drag_coefficient": 0.00015,

    # Anomaly deviation thresholds against LightGBM expected baseline (%)
    "fuel_deviation_info_pct": 12.0,     # +12% above expected
    "fuel_deviation_warning_pct": 25.0,  # +25% above expected
    "fuel_deviation_critical_pct": 45.0, # +45% above expected
}

# ---------------------------------------------------------------------------
# 5. ALERT DEBOUNCING & WINDOW SETTINGS
# ---------------------------------------------------------------------------
ALERT_SETTINGS = {
    "rolling_window_seconds": 15,        # Default window size for behaviour analysis
    "min_samples_for_alert": 5,          # Minimum consecutive/windowed samples
    "alert_cooldown_seconds": 20,        # Minimum seconds between duplicate alerts
    "escalation_persistence_seconds": 30 # Time in state before escalating warning to critical
}
