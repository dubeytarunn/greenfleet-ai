"""
GreenFlow AI - ML Inference & Decision Support Interface
Provides lightweight, standalone inference functions strictly adhering to GreenFlow JSON contracts:
1. Trip-Level Route Optimization & Allocation (Backward Compatible)
2. Real-Time Vehicle Telemetry Fuel Consumption, Behavior Detection & Alerting
"""

import os
import sys
from typing import Dict, List, Any, Union, Optional
import joblib
import numpy as np
import pandas as pd

# Ensure ml_engine directory is on sys.path without overriding project root
_ML_DIR = os.path.dirname(os.path.abspath(__file__))
if _ML_DIR not in sys.path:
    sys.path.append(_ML_DIR)


from features import FleetFeatureEngineer
from config import EMISSION_FACTORS_KG_CO2_PER_UNIT, FUEL_PRICES_INR_PER_UNIT
from inference.fuel_predictor import predict_fuel_consumption, load_telemetry_model, get_telemetry_model
from inference.fuel_waste_estimator import estimate_fuel_waste, calculate_fuel_deviation_pct
from inference.refuel_predictor import estimate_remaining_range
from alerts.alert_engine import process_telemetry, AlertEngine

# Standard Greenhouse Gas (GHG) Emission Factors alias
EMISSION_FACTORS_KG_CO2_PER_LITRE = EMISSION_FACTORS_KG_CO2_PER_UNIT

# Global in-memory cache for loaded trip model
_LOADED_MODEL = None
_DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "models", "fuel_model.pkl"
)


def load_model(model_path: Optional[str] = None):
    """
    Loads the trained fuel consumption model artifact.
    Caches model in memory for high-throughput batch inference.
    """
    global _LOADED_MODEL
    path = model_path or _DEFAULT_MODEL_PATH

    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Model artifact not found at '{path}'. Please train the model using 'python train.py' first."
        )

    _LOADED_MODEL = joblib.load(path)
    return _LOADED_MODEL


def get_model(model_path: Optional[str] = None):
    """Returns the cached model instance or loads it if not already loaded."""
    global _LOADED_MODEL
    if _LOADED_MODEL is None or model_path is not None:
        return load_model(model_path)
    return _LOADED_MODEL


def estimate_co2(fuel_litres: float, fuel_type: str = "Diesel") -> float:
    """
    Estimates carbon dioxide emissions (kg CO2) resulting from fuel combustion.
    """
    factor = EMISSION_FACTORS_KG_CO2_PER_LITRE.get(
        fuel_type, EMISSION_FACTORS_KG_CO2_PER_LITRE["Default"]
    )
    co2_kg = float(fuel_litres) * factor
    return round(co2_kg, 1)


def _prepare_inference_row(vehicle: Dict[str, Any], route: Dict[str, Any]) -> Dict[str, Any]:
    """
    Constructs a feature row from Vehicle and Route JSON contracts.
    """
    fuel_type = vehicle.get("fuel_type") or vehicle.get("engine_type", "Diesel")
    required_payload = route.get("required_payload_kg")
    if required_payload is None:
        required_payload = vehicle.get("load_kg", 500.0)

    max_payload = vehicle.get("max_payload_kg")
    if max_payload is None:
        type_defaults = {"Van": 1500.0, "Light Commercial": 3500.0, "Truck": 8000.0, "Semi-Trailer": 26000.0, "Bus": 6000.0}
        max_payload = type_defaults.get(vehicle.get("vehicle_type", "Truck"), 5000.0)

    distance_km = float(route.get("distance_km", 50.0))
    traffic_factor = float(route.get("traffic_factor", 1.0))

    avg_speed = route.get("average_speed_kmph")
    if avg_speed is None:
        avg_speed = 70.0 / traffic_factor if distance_km > 60 else 45.0 / traffic_factor

    road_grade = float(route.get("road_grade", 0.0))
    weather_factor = float(route.get("weather_factor", 1.0))

    return {
        "vehicle_id": str(vehicle.get("vehicle_id", "V_UNKNOWN")),
        "vehicle_type": str(vehicle.get("vehicle_type", "Truck")),
        "fuel_type": str(fuel_type),
        "vehicle_age": float(vehicle.get("vehicle_age", 3)),
        "fuel_capacity_l": float(vehicle.get("fuel_capacity_l", 180)),
        "max_payload_kg": float(max_payload),
        "available": bool(vehicle.get("available", True)),
        "route_id": str(route.get("route_id", "R_UNKNOWN")),
        "origin": str(route.get("origin", "Depot A")),
        "destination": str(route.get("destination", "Zone 1")),
        "distance_km": distance_km,
        "required_payload_kg": float(required_payload),
        "traffic_factor": traffic_factor,
        "priority": int(route.get("priority", 1)),
        "average_speed_kmph": float(avg_speed),
        "road_grade": road_grade,
        "weather_factor": weather_factor,
    }


def predict_fuel(
    vehicle_data: Dict[str, Any],
    route_data: Dict[str, Any],
    model: Any = None,
) -> float:
    """
    Predicts the fuel consumption in litres for a vehicle assigned to a route.
    """
    mdl = model or get_model()
    row = _prepare_inference_row(vehicle_data, route_data)
    df = pd.DataFrame([row])
    pred = mdl.predict(df)[0]
    return round(float(max(0.1, pred)), 1)


# Conformal prediction calibration quantile (q_hat at 90% / 95% empirical coverage on fleet benchmark)
CONFORMAL_Q_HAT_90: float = 1.805
CONFORMAL_Q_HAT_95: float = 2.546


def calculate_dispersion_factor(vehicle_data: Dict[str, Any], route_data: Dict[str, Any]) -> float:
    """
    Computes heteroscedastic dispersion factor S(x) based on operational risk factors:
    - Traffic factor: higher traffic introduces stop-and-go variance
    - Payload stress ratio: operating close to or over payload limits increases variance
    - Vehicle age: older mechanical components increase prediction dispersion
    - Road grade & weather stress
    """
    traffic_factor = float(route_data.get("traffic_factor", 1.0))
    req_payload = float(route_data.get("required_payload_kg", 1000.0))
    max_payload = float(vehicle_data.get("max_payload_kg", 5000.0))
    age = float(vehicle_data.get("vehicle_age", 3.0))
    grade = float(route_data.get("road_grade", 0.0))
    weather = float(route_data.get("weather_factor", 1.0))

    payload_ratio = req_payload / max(max_payload, 1.0)
    traffic_stress = max(0.0, traffic_factor - 1.0)

    dispersion = (
        1.0
        + (0.35 * traffic_stress)
        + (0.25 * payload_ratio)
        + (0.04 * age)
        + (0.15 * max(0.0, weather - 1.0))
        + (0.05 * abs(grade))
    )
    return float(max(0.5, dispersion))


def predict_fuel_with_uncertainty(
    vehicle_data: Dict[str, Any],
    route_data: Dict[str, Any],
    model: Any = None,
    confidence_level: float = 0.90,
    risk_aversion_lambda: float = 0.0,
) -> Dict[str, float]:
    """
    Predicts fuel consumption with locally-adaptive conformal prediction bounds [F_low, F_high]
    and computes risk-adjusted fuel: F_risk = F_hat + lambda * (F_high - F_hat).
    """
    pred_fuel = predict_fuel(vehicle_data, route_data, model=model)
    dispersion = calculate_dispersion_factor(vehicle_data, route_data)

    q_hat = CONFORMAL_Q_HAT_95 if confidence_level >= 0.95 else CONFORMAL_Q_HAT_90
    uncertainty_l = round(float(q_hat * dispersion), 2)

    fuel_lower_l = round(float(max(0.1, pred_fuel - uncertainty_l)), 2)
    fuel_upper_l = round(float(pred_fuel + uncertainty_l), 2)
    uncertainty_pct = round(float((uncertainty_l / max(0.1, pred_fuel)) * 100.0), 1)

    risk_adjusted_fuel = round(float(pred_fuel + (max(0.0, risk_aversion_lambda) * uncertainty_l)), 2)

    return {
        "predicted_fuel_l": pred_fuel,
        "fuel_lower_l": fuel_lower_l,
        "fuel_upper_l": fuel_upper_l,
        "uncertainty_l": uncertainty_l,
        "uncertainty_pct": uncertainty_pct,
        "risk_adjusted_fuel_l": risk_adjusted_fuel,
        "confidence_level": confidence_level,
    }


def predict_trip(
    vehicle_data: Dict[str, Any],
    route_data: Dict[str, Any],
    model: Any = None,
    risk_aversion_lambda: float = 0.0,
) -> Dict[str, Any]:
    """
    Generates standard Prediction JSON contract extended with uncertainty and risk-adjusted fuel:
    {
      "vehicle_id": "V001",
      "route_id": "R001",
      "predicted_fuel_l": 18.4,
      "fuel_lower_l": 15.6,
      "fuel_upper_l": 21.2,
      "uncertainty_l": 2.8,
      "uncertainty_pct": 15.2,
      "risk_adjusted_fuel_l": 19.8,
      "estimated_co2_kg": 48.8,
      "confidence_level": 0.90
    }
    """
    unc_res = predict_fuel_with_uncertainty(
        vehicle_data, route_data, model=model, risk_aversion_lambda=risk_aversion_lambda
    )
    fuel_l = unc_res["predicted_fuel_l"]
    fuel_type = vehicle_data.get("fuel_type") or vehicle_data.get("engine_type", "Diesel")
    co2_kg = estimate_co2(fuel_l, fuel_type=fuel_type)

    return {
        "vehicle_id": str(vehicle_data.get("vehicle_id", "V001")),
        "route_id": str(route_data.get("route_id", "R001")),
        "predicted_fuel_l": fuel_l,
        "fuel_lower_l": unc_res["fuel_lower_l"],
        "fuel_upper_l": unc_res["fuel_upper_l"],
        "uncertainty_l": unc_res["uncertainty_l"],
        "uncertainty_pct": unc_res["uncertainty_pct"],
        "risk_adjusted_fuel_l": unc_res["risk_adjusted_fuel_l"],
        "estimated_co2_kg": co2_kg,
        "confidence_level": unc_res["confidence_level"],
    }



def create_assignment(
    vehicle_id: str,
    route_id: str,
    predicted_fuel_l: float,
    status: str = "assigned",
) -> Dict[str, Any]:
    """
    Generates standard Assignment JSON contract.
    """
    return {
        "vehicle_id": str(vehicle_id),
        "route_id": str(route_id),
        "predicted_fuel_l": round(float(predicted_fuel_l), 1),
        "status": str(status),
    }


def build_fuel_cost_matrix(
    vehicles: List[Dict[str, Any]],
    routes: List[Dict[str, Any]],
    model: Any = None,
) -> Dict[str, Dict[str, float]]:
    """
    Constructs the vehicle-route fuel consumption cost matrix for Person 3 (Quantum Optimizer).
    """
    mdl = model or get_model()

    if not vehicles or not routes:
        return {}

    batch_records = []
    mapping_indices = []

    for v in vehicles:
        v_id = str(v.get("vehicle_id", "V_UNKNOWN"))
        for r in routes:
            r_id = str(r.get("route_id", "R_UNKNOWN"))
            row = _prepare_inference_row(v, r)
            batch_records.append(row)
            mapping_indices.append((v_id, r_id))

    batch_df = pd.DataFrame(batch_records)
    raw_predictions = mdl.predict(batch_df)

    matrix: Dict[str, Dict[str, float]] = {
        str(v.get("vehicle_id", "V_UNKNOWN")): {} for v in vehicles
    }

    for (v_id, r_id), pred_fuel in zip(mapping_indices, raw_predictions):
        matrix[v_id][r_id] = round(float(max(0.1, pred_fuel)), 1)

    return matrix


def build_trip_cost_matrix(
    vehicles: List[Dict[str, Any]],
    routes: List[Dict[str, Any]],
    model: Any = None,
) -> Dict[str, Dict[str, Dict[str, float]]]:
    """
    Constructs matrix with both predicted_fuel_l and estimated_co2_kg for every vehicle-route pair.
    """
    fuel_matrix = build_fuel_cost_matrix(vehicles, routes, model=model)
    v_fuel_type_lookup = {
        str(v.get("vehicle_id", "V_UNKNOWN")): v.get("fuel_type") or v.get("engine_type", "Diesel")
        for v in vehicles
    }

    full_matrix: Dict[str, Dict[str, Dict[str, float]]] = {}
    for v_id, routes_dict in fuel_matrix.items():
        full_matrix[v_id] = {}
        f_type = v_fuel_type_lookup.get(v_id, "Diesel")
        for r_id, fuel_val in routes_dict.items():
            full_matrix[v_id][r_id] = {
                "predicted_fuel_l": fuel_val,
                "estimated_co2_kg": estimate_co2(fuel_val, fuel_type=f_type),
            }

    return full_matrix


if __name__ == "__main__":
    import json

    print("[GreenFlow ML] Testing unified inference interface...")
    sample_vehicle = {
        "vehicle_id": "V001",
        "vehicle_type": "Truck",
        "fuel_type": "Diesel",
        "vehicle_age": 4,
        "fuel_capacity_l": 180,
        "max_payload_kg": 5000,
        "available": True,
    }

    sample_route = {
        "route_id": "R001",
        "origin": "Depot A",
        "destination": "Zone 1",
        "distance_km": 42.5,
        "required_payload_kg": 3200,
        "traffic_factor": 1.2,
        "priority": 2,
    }

    pred_contract = predict_trip(sample_vehicle, sample_route)
    print("Prediction Contract:", json.dumps(pred_contract, indent=2))

    sample_telemetry = {
        "vehicle_id": "V001",
        "speed_kmph": 62.0,
        "acceleration_mps2": 2.9,
        "rpm": 2800,
        "gear": 4,
        "engine_load_pct": 85.0,
        "road_slope_pct": 1.5,
        "vehicle_type": "Truck",
        "fuel_type": "Diesel",
        "fuel_rate_lph": 24.5,
        "fuel_level_l": 65.0,
    }

    alert_out = process_telemetry([sample_telemetry])
    print("\nTelemetry Alert Output:", json.dumps(alert_out, indent=2))
