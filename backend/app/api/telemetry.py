"""
GreenFleet AI - Driving-Behavior Telemetry API Router
======================================================
Endpoints to log a per-vehicle driving-style sample and read back its rolling
behavior score / optimizer fuel-cost multiplier.
"""

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from backend.app.core import behavior_registry

router = APIRouter(prefix="/telemetry", tags=["Driver Behavior Telemetry"])


class TelemetrySampleRequest(BaseModel):
    brake_freq: float = Field(..., ge=0, description="Brake events per 10km")
    gear_irregularity: float = Field(..., ge=0, le=100, description="Irregular gear-change percentage")
    harsh_accel: float = Field(..., ge=0, description="Harsh acceleration event count")


class TelemetrySampleResponse(BaseModel):
    vehicle_id: str
    score: float
    rolling_score: float
    behavior_multiplier: float


class BehaviorScoreResponse(BaseModel):
    vehicle_id: str
    rolling_score: Optional[float]
    behavior_multiplier: float
    sample_count: int


@router.post("/{vehicle_id}", response_model=TelemetrySampleResponse)
def log_telemetry_sample(vehicle_id: str, payload: TelemetrySampleRequest):
    """Logs one driving-behavior sample for a vehicle and returns its updated
    rolling score and the multiplier the optimizer will now apply."""
    score = behavior_registry.log_sample(
        vehicle_id, payload.brake_freq, payload.gear_irregularity, payload.harsh_accel
    )
    return TelemetrySampleResponse(
        vehicle_id=vehicle_id,
        score=score,
        rolling_score=behavior_registry.get_rolling_score(vehicle_id),
        behavior_multiplier=behavior_registry.get_behavior_multiplier(vehicle_id),
    )


@router.get("/{vehicle_id}", response_model=BehaviorScoreResponse)
def get_telemetry_score(vehicle_id: str):
    """Returns a vehicle's current rolling driving-behavior score."""
    samples = behavior_registry.get_recent_samples(vehicle_id)
    return BehaviorScoreResponse(
        vehicle_id=vehicle_id,
        rolling_score=behavior_registry.get_rolling_score(vehicle_id),
        behavior_multiplier=behavior_registry.get_behavior_multiplier(vehicle_id),
        sample_count=len(samples),
    )
