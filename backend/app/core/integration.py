"""
GreenFlow AI - Integration Bridge for ML & Quantum Optimizer
Adapts ML prediction and optimizer engine interfaces cleanly into backend models.
"""

import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional

from .config import settings
from .optimizer import optimize_routes
from .quantum_optimizer import (
    OptimizationConfig as CoreOptConfig,
    Prediction as CorePrediction,
    Route as CoreRoute,
    Vehicle as CoreVehicle,
)
from ..models.assignment import (
    AssignmentModel,
    OptimizationConfigModel,
    PredictionModel,
)
from ..models.route import RouteModel
from ..models.vehicle import VehicleModel

logger = logging.getLogger(__name__)

# Add project root to sys.path so ml_engine can be imported reliably
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from ml_engine.predict import estimate_co2, predict_trip, build_fuel_cost_matrix
    ML_AVAILABLE = True
except Exception as e:
    logger.warning(f"ml_engine import failed: {e}. Using physics-grounded fallback.")
    ML_AVAILABLE = False


def _physics_fallback_prediction(
    vehicle: VehicleModel,
    route: RouteModel,
    risk_aversion_lambda: float = 0.5,
) -> Dict[str, float]:
    """
    High-fidelity physics-based fuel estimation fallback in case ML model is unavailable.
    Fuel (L) = (Base_Rate * Distance / 100) * Load_Factor * Traffic_Factor * Age_Factor
    """
    base_l_per_100km = {
        "Van": 10.5,
        "Light Commercial": 16.0,
        "Truck": 26.0,
        "Semi-Trailer": 36.0,
        "Bus": 28.0,
    }.get(vehicle.vehicle_type, 22.0)
    
    # Powertrain adjustment
    if vehicle.fuel_type == "Hybrid":
        base_l_per_100km *= 0.75
    elif vehicle.fuel_type == "CNG":
        base_l_per_100km *= 0.90
    elif vehicle.fuel_type == "Petrol":
        base_l_per_100km *= 1.10
        
    # Load factor: cargo weight relative to vehicle max payload
    load_ratio = min(1.5, route.required_payload_kg / max(vehicle.max_payload_kg, 1.0))
    load_multiplier = 1.0 + (0.35 * load_ratio)
    
    # Traffic multiplier
    traffic_multiplier = 1.0 + ((route.traffic_factor - 1.0) * 0.6)
    
    # Age factor
    age_multiplier = 1.0 + (vehicle.vehicle_age * 0.015)
    
    total_fuel = (base_l_per_100km * (route.distance_km / 100.0)) * load_multiplier * traffic_multiplier * age_multiplier
    pred_fuel = round(float(max(1.0, total_fuel)), 1)
    
    # Conformal dispersion scaling
    traffic_stress = max(0.0, route.traffic_factor - 1.0)
    dispersion = 1.0 + (0.35 * traffic_stress) + (0.25 * load_ratio) + (0.04 * vehicle.vehicle_age)
    uncertainty = round(float(1.805 * dispersion), 2)
    fuel_lower = round(float(max(0.1, pred_fuel - uncertainty)), 2)
    fuel_upper = round(float(pred_fuel + uncertainty), 2)
    unc_pct = round(float((uncertainty / pred_fuel) * 100.0), 1)
    risk_adj = round(float(pred_fuel + (max(0.0, risk_aversion_lambda) * uncertainty)), 2)
    
    return {
        "predicted_fuel_l": pred_fuel,
        "fuel_lower_l": fuel_lower,
        "fuel_upper_l": fuel_upper,
        "uncertainty_l": uncertainty,
        "uncertainty_pct": unc_pct,
        "risk_adjusted_fuel_l": risk_adj,
    }


def predict_fuel_and_co2(
    vehicles: List[VehicleModel],
    routes: List[RouteModel],
    risk_aversion_lambda: float = 0.5,
) -> List[PredictionModel]:
    """
    Generates fuel and CO2 predictions with conformal uncertainty bounds for all (vehicle, route) pairs.
    Uses trained LightGBM ML model if available; otherwise uses physics fallback.
    """
    predictions: List[PredictionModel] = []
    
    for v in vehicles:
        for r in routes:
            trip_data: Optional[Dict[str, Any]] = None
            
            if ML_AVAILABLE:
                try:
                    v_dict = v.model_dump()
                    r_dict = r.model_dump()
                    trip_data = predict_trip(v_dict, r_dict, risk_aversion_lambda=risk_aversion_lambda)
                except Exception as ex:
                    logger.debug(f"ML inference fallback for ({v.vehicle_id}, {r.route_id}): {ex}")
            
            if trip_data is None:
                phys = _physics_fallback_prediction(v, r, risk_aversion_lambda=risk_aversion_lambda)
                factor = settings.EMISSION_FACTORS_KG_CO2_PER_LITRE.get(
                    v.fuel_type, settings.EMISSION_FACTORS_KG_CO2_PER_LITRE["Default"]
                )
                co2_val = round(phys["predicted_fuel_l"] * factor, 1)
                trip_data = {
                    "vehicle_id": v.vehicle_id,
                    "route_id": r.route_id,
                    "predicted_fuel_l": phys["predicted_fuel_l"],
                    "fuel_lower_l": phys["fuel_lower_l"],
                    "fuel_upper_l": phys["fuel_upper_l"],
                    "uncertainty_l": phys["uncertainty_l"],
                    "uncertainty_pct": phys["uncertainty_pct"],
                    "risk_adjusted_fuel_l": phys["risk_adjusted_fuel_l"],
                    "estimated_co2_kg": co2_val,
                    "confidence_level": 0.90,
                }
            
            predictions.append(
                PredictionModel(
                    vehicle_id=v.vehicle_id,
                    route_id=r.route_id,
                    predicted_fuel_l=trip_data["predicted_fuel_l"],
                    estimated_co2_kg=trip_data["estimated_co2_kg"],
                    fuel_lower_l=trip_data.get("fuel_lower_l"),
                    fuel_upper_l=trip_data.get("fuel_upper_l"),
                    uncertainty_l=trip_data.get("uncertainty_l"),
                    uncertainty_pct=trip_data.get("uncertainty_pct"),
                    risk_adjusted_fuel_l=trip_data.get("risk_adjusted_fuel_l"),
                    confidence_level=trip_data.get("confidence_level", 0.90),
                    confidence=0.95 if ML_AVAILABLE else 0.85,
                )
            )
            
    return predictions


def run_greenflow_optimizer(
    vehicles: List[VehicleModel],
    routes: List[RouteModel],
    predictions: Optional[List[PredictionModel]] = None,
    config: Optional[OptimizationConfigModel] = None,
    method: str = "quantum_inspired",
) -> Dict[str, Any]:
    """
    Runs the optimizer (Person 3 interface) with risk-adjusted fuel and dynamic carbon weight.
    """
    lambda_val = config.risk_aversion_lambda if config else 0.5
    if predictions is None:
        predictions = predict_fuel_and_co2(vehicles, routes, risk_aversion_lambda=lambda_val)
        
    # Convert Pydantic models to Person 3 Core Dataclasses
    core_vehicles = [
        CoreVehicle(
            vehicle_id=v.vehicle_id,
            vehicle_type=v.vehicle_type,
            fuel_type=v.fuel_type,
            vehicle_age=v.vehicle_age,
            fuel_capacity_l=v.fuel_capacity_l,
            max_payload_kg=v.max_payload_kg,
            available=v.available,
        )
        for v in vehicles
    ]
    
    core_routes = [
        CoreRoute(
            route_id=r.route_id,
            origin=r.origin,
            destination=r.destination,
            distance_km=r.distance_km,
            required_payload_kg=r.required_payload_kg,
            traffic_factor=r.traffic_factor,
            priority=r.priority,
        )
        for r in routes
    ]
    
    core_predictions = [
        CorePrediction(
            vehicle_id=p.vehicle_id,
            route_id=p.route_id,
            predicted_fuel_l=p.predicted_fuel_l,
            estimated_co2_kg=p.estimated_co2_kg,
            fuel_lower_l=p.fuel_lower_l,
            fuel_upper_l=p.fuel_upper_l,
            uncertainty_l=p.uncertainty_l,
            uncertainty_pct=p.uncertainty_pct,
            risk_adjusted_fuel_l=p.risk_adjusted_fuel_l,
            confidence_level=p.confidence_level or 0.90,
        )
        for p in predictions
    ]
    
    core_config = None
    if config:
        core_config = CoreOptConfig(
            fuel_weight=config.fuel_weight,
            co2_weight=config.co2_weight,
            distance_weight=config.distance_weight,
            risk_aversion_lambda=config.risk_aversion_lambda,
            imbalance_weight=config.imbalance_weight,
            capacity_shortfall_penalty=config.capacity_shortfall_penalty,
            constraint_penalty=config.constraint_penalty,
            initial_temp=config.initial_temp,
            cooling_rate=config.cooling_rate,
            min_temp=config.min_temp,
            max_iterations=config.max_iterations,
            seed=config.seed,
        )
    
    t0 = time.perf_counter()
    raw_assignments = optimize_routes(
        vehicles=core_vehicles,
        routes=core_routes,
        predictions=core_predictions,
        config=core_config,
        method=method,
    )
    runtime = time.perf_counter() - t0
    
    # Map predictions and vehicle details to calculate full assignment metadata
    v_lookup = {v.vehicle_id: v for v in vehicles}
    r_lookup = {r.route_id: r for r in routes}
    pred_lookup = {(p.vehicle_id, p.route_id): p for p in predictions}
    
    assignment_models: List[AssignmentModel] = []
    total_fuel = 0.0
    total_co2 = 0.0
    total_cost = 0.0
    
    for item in raw_assignments:
        v_id = item["vehicle_id"]
        r_id = item["route_id"]
        pred = pred_lookup.get((v_id, r_id))
        veh = v_lookup.get(v_id)
        rt = r_lookup.get(r_id)
        
        fuel_val = float(item.get("predicted_fuel_l") or (pred.predicted_fuel_l if pred else 0.0))
        co2_val = float(pred.estimated_co2_kg if pred else (fuel_val * 2.68))
        
        # Calculate cost
        fuel_price = settings.FUEL_PRICES_PER_LITRE.get(
            veh.fuel_type if veh else "Diesel", settings.FUEL_PRICES_PER_LITRE["Default"]
        )
        base_km_rate = settings.VEHICLE_TYPE_BASE_COST_PER_KM.get(
            veh.vehicle_type if veh else "Default", settings.VEHICLE_TYPE_BASE_COST_PER_KM["Default"]
        )
        dist = rt.distance_km if rt else 50.0
        
        op_cost = round((fuel_val * fuel_price) + (dist * base_km_rate), 2)
        
        total_fuel += fuel_val
        total_co2 += co2_val
        total_cost += op_cost
        
        assignment_models.append(
            AssignmentModel(
                vehicle_id=v_id,
                route_id=r_id,
                predicted_fuel_l=round(fuel_val, 1),
                estimated_co2_kg=round(co2_val, 1),
                fuel_lower_l=item.get("fuel_lower_l") or (pred.fuel_lower_l if pred else None),
                fuel_upper_l=item.get("fuel_upper_l") or (pred.fuel_upper_l if pred else None),
                uncertainty_l=item.get("uncertainty_l") or (pred.uncertainty_l if pred else None),
                uncertainty_pct=item.get("uncertainty_pct") or (pred.uncertainty_pct if pred else None),
                risk_adjusted_fuel_l=item.get("risk_adjusted_fuel_l") or (pred.risk_adjusted_fuel_l if pred else None),
                operating_cost=op_cost,
                status="assigned",
            )
        )

    
    avail_count = sum(1 for v in vehicles if v.available)
    utilisation = (len(assignment_models) / max(avail_count, 1)) * 100.0 if avail_count > 0 else 0.0
    
    return {
        "success": True,
        "method": method,
        "assignments": assignment_models,
        "total_predicted_fuel_l": round(total_fuel, 1),
        "total_estimated_co2_kg": round(total_co2, 1),
        "total_operating_cost": round(total_cost, 2),
        "fleet_utilisation_pct": round(utilisation, 1),
        "feasible": True,
        "runtime_seconds": round(runtime, 4),
        "constraint_violations": [],
        "error": None,
    }
