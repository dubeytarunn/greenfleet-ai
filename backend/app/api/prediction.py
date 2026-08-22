"""
GreenFleet AI - ML Prediction & Real-Time Intelligence API Router
=================================================================
Batch prediction endpoints for Vehicle Fuel/Energy Consumption and CO2 Emissions,
as well as real-time driver telemetry analysis, behavioral coaching, and range estimation.
Integrates Person 2's trained LightGBM ML Engine.
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import (
    BatchPredictionRequest,
    BatchPredictionResponse,
    Prediction,
    VehiclePair,
    TelemetryAnalysisRequest,
    TelemetryAlertResponse,
    RangeEstimateRequest,
    RangeEstimateResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/predict", tags=["ML Prediction & Driver Intelligence"])

# Attempt to load Person 2's ML Engine
ML_AVAILABLE = False
try:
    from ml_engine.predict import predict_trip, process_telemetry, estimate_remaining_range
    ML_AVAILABLE = True
except Exception as e:
    logger.warning(f"ML engine could not be loaded: {e}. Using fallback physics predictor.")


def _calculate_stub_prediction(pair: VehiclePair) -> Prediction:
    """
    Fallback deterministic physics-based prediction estimation with uncertainty bounds.
    """
    v = pair.vehicle
    r = pair.route

    base_rate = {
        "Diesel": 28.0 if "Truck" in v.vehicle_type else 12.0,
        "Electric": 20.0,
        "Petrol": 14.0,
        "Hybrid": 10.0,
        "CNG": 16.0,
    }.get(v.fuel_type, 20.0)

    emission_factor = {
        "Diesel": 2.68,
        "Electric": 0.45,
        "Petrol": 2.31,
        "Hybrid": 1.50,
        "CNG": 1.80,
    }.get(v.fuel_type, 2.50)

    payload_ratio = min(1.0, r.required_payload_kg / max(1.0, v.max_payload_kg))
    payload_multiplier = 1.0 + (0.35 * payload_ratio)
    age_multiplier = 1.0 + (0.01 * v.vehicle_age)

    pred_fuel = (r.distance_km / 100.0) * base_rate * r.traffic_factor * payload_multiplier * age_multiplier
    pred_fuel = round(pred_fuel, 2)
    pred_co2 = round(pred_fuel * emission_factor, 2)

    traffic_stress = max(0.0, r.traffic_factor - 1.0)
    dispersion = 1.0 + (0.35 * traffic_stress) + (0.25 * payload_ratio) + (0.04 * v.vehicle_age)
    uncertainty = round(float(1.805 * dispersion), 2)
    fuel_lower = round(float(max(0.1, pred_fuel - uncertainty)), 2)
    fuel_upper = round(float(pred_fuel + uncertainty), 2)
    unc_pct = round(float((uncertainty / pred_fuel) * 100.0), 1)

    return Prediction(
        vehicle_id=v.vehicle_id,
        route_id=r.route_id,
        predicted_fuel_l=pred_fuel,
        estimated_co2_kg=pred_co2,
        fuel_lower_l=fuel_lower,
        fuel_upper_l=fuel_upper,
        uncertainty_l=uncertainty,
        uncertainty_pct=unc_pct,
        risk_adjusted_fuel_l=round(pred_fuel + (0.5 * uncertainty), 2),
        confidence_level=0.90,
    )


@router.post("/batch", response_model=BatchPredictionResponse)
def batch_predict(request: BatchPredictionRequest):
    """
    Evaluate fuel consumption and CO2 emissions for a batch of candidate (Vehicle, Route) pairs.
    Uses trained LightGBM ML model artifact with conformal prediction bounds.
    """
    predictions: List[Prediction] = []
    for pair in request.pairs:
        if ML_AVAILABLE:
            try:
                v_dict = pair.vehicle.model_dump()
                r_dict = pair.route.model_dump()
                res = predict_trip(v_dict, r_dict)
                pred = Prediction(
                    vehicle_id=res["vehicle_id"],
                    route_id=res["route_id"],
                    predicted_fuel_l=float(res["predicted_fuel_l"]),
                    estimated_co2_kg=float(res["estimated_co2_kg"]),
                    fuel_lower_l=res.get("fuel_lower_l"),
                    fuel_upper_l=res.get("fuel_upper_l"),
                    uncertainty_l=res.get("uncertainty_l"),
                    uncertainty_pct=res.get("uncertainty_pct"),
                    risk_adjusted_fuel_l=res.get("risk_adjusted_fuel_l"),
                    confidence_level=res.get("confidence_level", 0.90),
                )
                predictions.append(pred)
                continue
            except Exception as ex:
                logger.debug(f"Inference error on pair ({pair.vehicle.vehicle_id}, {pair.route.route_id}): {ex}")

        # Fallback if ML inference not available
        predictions.append(_calculate_stub_prediction(pair))

    return BatchPredictionResponse(
        predictions=predictions,
        total_evaluated=len(predictions),
    )



@router.post("/telemetry", response_model=TelemetryAlertResponse)
def analyze_telemetry_stream(request: TelemetryAnalysisRequest):
    """
    Real-time driver-efficiency intelligence endpoint:
    Evaluates a rolling window of vehicle telemetry, computes LightGBM expected fuel baseline,
    detects inefficient driving behavior (excessive revving, harsh accel, downhill accel, inefficient gear, idle),
    calculates excess fuel wasted in litres, financial cost in INR, CO2 impact, and issues coaching alerts.
    """
    if not request.window:
        raise HTTPException(status_code=400, detail="Telemetry window cannot be empty.")

    records = [f.model_dump() for f in request.window]

    if ML_AVAILABLE:
        try:
            alert = process_telemetry(records, fuel_price_inr=request.fuel_price_inr)
            return TelemetryAlertResponse(**alert)
        except Exception as ex:
            logger.error(f"Error processing telemetry window: {ex}")
            raise HTTPException(status_code=500, detail=f"Telemetry analysis error: {ex}")

    # Fallback response if ML package not loaded
    last = records[-1]
    return TelemetryAlertResponse(
        vehicle_id=last.get("vehicle_id", "V001"),
        behaviour="normal",
        severity="NORMAL",
        behaviour_score=95.0,
        fuel_deviation_pct=0.0,
        fuel_wasted_l=0.0,
        estimated_cost_inr=0.0,
        co2_impact_kg=0.0,
        remaining_range_km=150.0,
        refuel_required=False,
        message="Optimal driving behavior (fallback evaluator).",
    )


@router.post("/range", response_model=RangeEstimateResponse)
def calculate_remaining_range(request: RangeEstimateRequest):
    """
    Dynamic remaining range and refuel urgency evaluation.
    """
    if ML_AVAILABLE:
        try:
            res = estimate_remaining_range(
                fuel_level_l=request.fuel_level_l,
                expected_efficiency_kmpl=request.expected_efficiency_kmpl,
                current_efficiency_kmpl=request.current_efficiency_kmpl,
                vehicle_type=request.vehicle_type,
                fuel_capacity_l=request.fuel_capacity_l,
                trip_remaining_distance_km=request.trip_remaining_distance_km,
            )
            return RangeEstimateResponse(**res)
        except Exception as ex:
            logger.error(f"Error estimating range: {ex}")
            raise HTTPException(status_code=500, detail=f"Range estimation error: {ex}")

    # Fallback
    range_km = request.fuel_level_l * request.expected_efficiency_kmpl
    return RangeEstimateResponse(
        fuel_level_l=request.fuel_level_l,
        fuel_level_pct=50.0,
        estimated_range_km=range_km,
        blended_efficiency_kmpl=request.expected_efficiency_kmpl,
        refuel_required=range_km < 40.0,
        refuel_warning="Low fuel" if range_km < 40.0 else None,
    )
