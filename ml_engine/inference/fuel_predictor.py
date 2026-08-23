"""
GreenFlow AI - Real-Time Telemetry Fuel Predictor
Loads trained LightGBM / GBDT telemetry model and outputs expected fuel metrics:
- expected_fuel_consumption_l_100km
- expected_fuel_rate_lph
- expected_efficiency_kmpl
"""

import os
import sys
from typing import Dict, Any, Union, Optional, List
import joblib
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from config import VEHICLE_PROFILES
from features import (
    TELEMETRY_CATEGORICAL_FEATURES,
    TELEMETRY_RAW_NUMERIC_FEATURES,
    TelemetryFeatureEngineer,
)

_LOADED_TELEMETRY_MODEL = None
_DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "telemetry_fuel_model.pkl"
)
_FALLBACK_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "fuel_model.pkl"
)


def load_telemetry_model(model_path: Optional[str] = None):
    """Loads and caches the telemetry fuel model pipeline artifact."""
    global _LOADED_TELEMETRY_MODEL
    path = model_path or _DEFAULT_MODEL_PATH
    if not os.path.exists(path):
        path = _FALLBACK_MODEL_PATH

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Telemetry fuel model artifact not found at '{path}'. Please run 'train_fuel_model.py' first."
        )

    _LOADED_TELEMETRY_MODEL = joblib.load(path)
    return _LOADED_TELEMETRY_MODEL


def get_telemetry_model(model_path: Optional[str] = None):
    """Returns cached telemetry model instance."""
    global _LOADED_TELEMETRY_MODEL
    if _LOADED_TELEMETRY_MODEL is None or model_path is not None:
        return load_telemetry_model(model_path)
    return _LOADED_TELEMETRY_MODEL


def _prepare_telemetry_frame(telemetry: Union[Dict[str, Any], List[Dict[str, Any]]]) -> pd.DataFrame:
    """Standardizes input telemetry into DataFrame ready for pipeline transform."""
    if isinstance(telemetry, dict):
        records = [telemetry]
    else:
        records = telemetry

    df = pd.DataFrame(records).copy()

    # Populate missing defaults safely
    if "vehicle_type" not in df.columns:
        df["vehicle_type"] = "Truck"
    if "fuel_type" not in df.columns:
        df["fuel_type"] = "Diesel"
    if "road_type" not in df.columns:
        df["road_type"] = "Highway"
    if "traffic_level" not in df.columns:
        df["traffic_level"] = "Medium"

    # Fill numerical defaults
    defaults = {
        "speed_kmph": 50.0,
        "acceleration_mps2": 0.0,
        "rpm": 1800.0,
        "gear": 4,
        "engine_load_pct": 50.0,
        "road_slope_pct": 0.0,
        "vehicle_age_years": 3,
        "engine_size_l": 5.0,
        "vehicle_weight_kg": 6000.0,
        "ambient_temperature_c": 25.0,
        "idle_duration_sec": 0,
    }
    for col, default_val in defaults.items():
        if col not in df.columns:
            df[col] = default_val
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(default_val)

    return df


def predict_fuel_consumption(
    telemetry: Union[Dict[str, Any], List[Dict[str, Any]]],
    model: Any = None,
) -> Dict[str, Any]:
    """
    Predicts expected fuel consumption metrics for a telemetry sample or batch:
    Returns:
    {
        "expected_fuel_consumption_l_100km": float,
        "expected_fuel_rate_lph": float,
        "expected_efficiency_kmpl": float
    }
    """
    mdl = model or get_telemetry_model()
    df = _prepare_telemetry_frame(telemetry)

    # Handle stationary idle specifically
    speed = float(df["speed_kmph"].iloc[-1])
    v_type = str(df["vehicle_type"].iloc[-1])
    profile = VEHICLE_PROFILES.get(v_type, VEHICLE_PROFILES["Truck"])

    if speed < 1.0:
        idle_rate = profile["idle_fuel_rate_lph"]
        return {
            "expected_fuel_consumption_l_100km": 0.0,
            "expected_fuel_rate_lph": round(float(idle_rate), 2),
            "expected_efficiency_kmpl": 0.0,
        }

    preds = mdl.predict(df)
    expected_l_100km = float(np.clip(preds[-1], 1.5, 95.0))
    expected_rate_lph = (expected_l_100km / 100.0) * speed
    expected_kmpl = 100.0 / expected_l_100km if expected_l_100km > 0 else 0.0

    return {
        "expected_fuel_consumption_l_100km": round(float(expected_l_100km), 2),
        "expected_fuel_rate_lph": round(float(expected_rate_lph), 2),
        "expected_efficiency_kmpl": round(float(expected_kmpl), 2),
    }
