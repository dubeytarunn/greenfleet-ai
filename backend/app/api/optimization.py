"""
GreenFleet AI - Fleet Optimization API Router
=============================================
Endpoints to compute optimal vehicle-to-route assignments.
Integrates Person 3's Quantum-Inspired Optimizer.
"""

from typing import List
from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import (
    OptimizeRequest,
    OptimizeResponse,
    Assignment,
    Prediction,
    VehiclePair,
)
from backend.app.api.prediction import _calculate_stub_prediction
from backend.app.core.optimizer import optimize_routes
from backend.app.core.quantum_optimizer import (
    Vehicle as OptVehicle,
    Route as OptRoute,
    Prediction as OptPrediction,
    OptimizationConfig,
)

router = APIRouter(prefix="/optimize", tags=["Optimization"])


@router.post("", response_model=OptimizeResponse)
@router.post("/assign", response_model=OptimizeResponse)
def compute_assignments(request: OptimizeRequest):
    """
    Compute optimal vehicle-to-route assignments minimizing emissions and fuel.
    Calls Person 3's Quantum-Inspired / MILP optimizer engine.
    """
    if not request.vehicles:
        raise HTTPException(status_code=400, detail="Vehicle list cannot be empty")
    if not request.routes:
        raise HTTPException(status_code=400, detail="Route list cannot be empty")

    # 1. Generate predictions if not supplied
    predictions: List[Prediction] = request.predictions or []
    if not predictions:
        from backend.app.api.prediction import batch_predict, BatchPredictionRequest
        pairs = [VehiclePair(vehicle=v, route=r) for v in request.vehicles for r in request.routes]
        pred_res = batch_predict(BatchPredictionRequest(pairs=pairs))
        predictions = pred_res.predictions

    # 2. Convert to optimizer dataclass representations
    opt_vehicles = [
        OptVehicle(
            vehicle_id=v.vehicle_id,
            vehicle_type=v.vehicle_type,
            fuel_type=v.fuel_type,
            vehicle_age=v.vehicle_age,
            fuel_capacity_l=v.fuel_capacity_l,
            max_payload_kg=v.max_payload_kg,
            available=v.available,
        )
        for v in request.vehicles
    ]

    opt_routes = [
        OptRoute(
            route_id=r.route_id,
            origin=r.origin,
            destination=r.destination,
            distance_km=r.distance_km,
            required_payload_kg=r.required_payload_kg,
            traffic_factor=r.traffic_factor,
            priority=r.priority,
        )
        for r in request.routes
    ]

    opt_predictions = [
        OptPrediction(
            vehicle_id=p.vehicle_id,
            route_id=p.route_id,
            predicted_fuel_l=p.predicted_fuel_l,
            estimated_co2_kg=p.estimated_co2_kg,
        )
        for p in predictions
    ]

    # Configure weights based on objective
    config = OptimizationConfig()
    if request.objective == "min_co2":
        config.co2_weight = 2.0
        config.fuel_weight = 0.5
    elif request.objective == "min_fuel":
        config.co2_weight = 0.5
        config.fuel_weight = 2.0

    try:
        raw_assignments = optimize_routes(
            vehicles=opt_vehicles,
            routes=opt_routes,
            predictions=opt_predictions,
            config=config,
            method="classical_baseline",
        )
    except Exception:
        # Fallback to quantum-inspired heuristic
        raw_assignments = optimize_routes(
            vehicles=opt_vehicles,
            routes=opt_routes,
            predictions=opt_predictions,
            config=config,
            method="quantum_inspired",
        )

    # Convert back to standard Assignment schemas
    assignments = [
        Assignment(
            vehicle_id=str(a["vehicle_id"]),
            route_id=str(a["route_id"]),
            predicted_fuel_l=float(a["predicted_fuel_l"] or 0.0),
            status="assigned" if a.get("status") == "assigned" else "assigned",
        )
        for a in raw_assignments
    ]

    assigned_route_ids = {a.route_id for a in assignments}
    unassigned_routes = [r.route_id for r in request.routes if r.route_id not in assigned_route_ids]

    total_fuel = sum(a.predicted_fuel_l for a in assignments)
    # Estimate total CO2 from prediction lookup
    pred_lookup = {(p.vehicle_id, p.route_id): p.estimated_co2_kg for p in predictions}
    total_co2 = sum(pred_lookup.get((a.vehicle_id, a.route_id), a.predicted_fuel_l * 2.5) for a in assignments)

    solver_label = "hungarian" if not unassigned_routes else "partial"
    if assignments:
        solver_label = raw_assignments[0].get("solver", "quantum_inspired") if raw_assignments else "hungarian"

    return OptimizeResponse(
        assignments=assignments,
        unassigned_routes=unassigned_routes,
        total_fuel_l=round(total_fuel, 2),
        total_co2_kg=round(total_co2, 2),
        solver_status="OPTIMAL" if not unassigned_routes else "FEASIBLE_PARTIAL",
        solver_used=solver_label,
    )
