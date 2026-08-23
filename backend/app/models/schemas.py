"""
GreenFleet AI - Core Shared Data Schemas
========================================
Strict data contracts for Vehicles, Routes, Predictions, and Assignments.
These schemas are shared across Backend, ML Engine, Optimizer, Simulation, and Frontend.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# 1. CORE CANONICAL CONTRACTS
# ---------------------------------------------------------------------------

class Vehicle(BaseModel):
    """
    Standard vehicle entity schema.
    Example:
    {
      "vehicle_id": "V001",
      "vehicle_type": "Truck",
      "fuel_type": "Diesel",
      "vehicle_age": 4,
      "fuel_capacity_l": 180.0,
      "max_payload_kg": 5000.0,
      "available": True
    }
    """
    vehicle_id: str = Field(..., description="Unique vehicle identifier, e.g. V001")
    vehicle_type: str = Field(..., description="Vehicle category: Truck, Van, EV_Van, etc.")
    fuel_type: str = Field(..., description="Fuel type: Diesel, Electric, Petrol, Hybrid, CNG")
    vehicle_age: int = Field(..., ge=0, description="Age of the vehicle in years")
    fuel_capacity_l: float = Field(..., gt=0, description="Fuel tank capacity in Litres or kWh equivalent")
    max_payload_kg: float = Field(..., gt=0, description="Maximum carrying payload in kilograms")
    available: bool = Field(default=True, description="Availability flag for dispatch")


class Route(BaseModel):
    """
    Standard route entity schema.
    Example:
    {
      "route_id": "R001",
      "origin": "Depot A",
      "destination": "Zone 1",
      "distance_km": 42.5,
      "required_payload_kg": 3200.0,
      "traffic_factor": 1.2,
      "priority": 2
    }
    """
    route_id: str = Field(..., description="Unique route identifier, e.g. R001")
    origin: str = Field(..., description="Starting point or depot")
    destination: str = Field(..., description="Target delivery zone or destination")
    distance_km: float = Field(..., gt=0, description="Distance in kilometres")
    required_payload_kg: float = Field(..., ge=0, description="Cargo payload requirement in kilograms")
    traffic_factor: float = Field(default=1.0, ge=0.5, le=5.0, description="Traffic congestion multiplier (1.0 = normal)")
    priority: int = Field(default=1, ge=1, le=5, description="Route priority level (1 = lowest, 5 = highest/critical)")


class Prediction(BaseModel):
    """
    Standard ML consumption & emissions prediction output with conformal prediction bounds.
    Example:
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
    vehicle_id: str = Field(..., description="Target vehicle identifier")
    route_id: str = Field(..., description="Target route identifier")
    predicted_fuel_l: float = Field(..., ge=0, description="Predicted fuel or energy consumption in litres/kWh")
    estimated_co2_kg: float = Field(..., ge=0, description="Estimated greenhouse emissions in kg CO2e")
    fuel_lower_l: Optional[float] = Field(default=None, description="Lower conformal bound (litres)")
    fuel_upper_l: Optional[float] = Field(default=None, description="Upper conformal bound (litres)")
    uncertainty_l: Optional[float] = Field(default=None, description="Prediction uncertainty half-width (litres)")
    uncertainty_pct: Optional[float] = Field(default=None, description="Relative uncertainty percentage (%)")
    risk_adjusted_fuel_l: Optional[float] = Field(default=None, description="Risk-adjusted fuel: F_hat + lambda * uncertainty")
    confidence_level: Optional[float] = Field(default=0.90, description="Conformal coverage confidence level")


class Assignment(BaseModel):
    """
    Standard Optimizer assignment result.
    Example:
    {
      "vehicle_id": "V001",
      "route_id": "R001",
      "predicted_fuel_l": 18.4,
      "risk_adjusted_fuel_l": 19.8,
      "status": "assigned"
    }
    """
    vehicle_id: str = Field(..., description="Assigned vehicle ID")
    route_id: str = Field(..., description="Assigned route ID")
    predicted_fuel_l: float = Field(..., ge=0, description="Predicted fuel or energy consumption for this assignment")
    fuel_lower_l: Optional[float] = Field(default=None, description="Lower conformal bound (litres)")
    fuel_upper_l: Optional[float] = Field(default=None, description="Upper conformal bound (litres)")
    uncertainty_l: Optional[float] = Field(default=None, description="Uncertainty half-width (litres)")
    uncertainty_pct: Optional[float] = Field(default=None, description="Relative uncertainty (%)")
    risk_adjusted_fuel_l: Optional[float] = Field(default=None, description="Risk-adjusted fuel (litres)")
    status: Literal["assigned", "unassigned", "failed", "pending"] = Field(
        default="assigned",
        description="Assignment status"
    )



# ---------------------------------------------------------------------------
# 2. COMPOSITE REQUEST & RESPONSE SCHEMAS
# ---------------------------------------------------------------------------

class VehiclePair(BaseModel):
    vehicle: Vehicle
    route: Route


class BatchPredictionRequest(BaseModel):
    pairs: List[VehiclePair] = Field(..., description="List of (Vehicle, Route) pairs to evaluate")


class BatchPredictionResponse(BaseModel):
    predictions: List[Prediction]
    total_evaluated: int


class OptimizeRequest(BaseModel):
    vehicles: List[Vehicle] = Field(..., description="Fleet of vehicles available for assignment")
    routes: List[Route] = Field(..., description="List of routes needing assignment")
    predictions: Optional[List[Prediction]] = Field(
        default=None,
        description="Optional precomputed ML predictions. If omitted, backend will invoke ML engine."
    )
    objective: Literal["min_co2", "min_fuel", "balanced"] = Field(
        default="balanced",
        description="Optimization objective criteria"
    )


class OptimizeResponse(BaseModel):
    assignments: List[Assignment]
    unassigned_routes: List[str] = Field(default_factory=list, description="Route IDs that could not be assigned")
    total_fuel_l: float
    total_co2_kg: float
    solver_status: str
    solver_used: Optional[str] = Field(default=None, description="Which solver was ultimately used")


class SimulationRunRequest(BaseModel):
    scenario: str = Field(default="normal", description="Scenario name: normal, peak_surge, traffic_anomaly, eco_fleet")
    traffic_multiplier: float = Field(default=1.0, ge=0.5, le=3.0)
    payload_multiplier: float = Field(default=1.0, ge=0.5, le=3.0)


class MetricReport(BaseModel):
    total_fuel_l: float
    total_co2_kg: float
    avg_efficiency_km_per_l: float
    routes_completed: int
    unassigned_count: int
    total_cost_usd: float


class SimulationRunResponse(BaseModel):
    scenario: str
    baseline: MetricReport
    optimized: MetricReport
    deltas: dict = Field(..., description="Comparison metrics (e.g. co2_saved_kg, co2_reduction_pct, fuel_saved_l)")


# ---------------------------------------------------------------------------
# 3. REAL-TIME TELEMETRY & ALERT INTELLIGENCE SCHEMAS
# ---------------------------------------------------------------------------

class TelemetryFrame(BaseModel):
    vehicle_id: str = Field(..., description="Unique vehicle identifier")
    timestamp: Optional[str] = Field(default=None, description="ISO timestamp")
    vehicle_type: str = Field(default="Truck", description="Vehicle class")
    fuel_type: str = Field(default="Diesel", description="Fuel type")
    speed_kmph: float = Field(..., ge=0, description="Vehicle speed in km/h")
    acceleration_mps2: float = Field(default=0.0, description="Acceleration in m/s^2")
    rpm: float = Field(default=1500.0, ge=0, description="Engine RPM")
    gear: int = Field(default=3, ge=0, description="Current transmission gear")
    throttle_position_pct: float = Field(default=30.0, ge=0, le=100)
    brake_pressure_pct: float = Field(default=0.0, ge=0, le=100)
    engine_load_pct: float = Field(default=50.0, ge=0, le=100)
    road_slope_pct: float = Field(default=0.0, description="Road elevation grade %")
    traffic_level: str = Field(default="Medium", description="Low, Medium, High, Gridlock")
    road_type: str = Field(default="Highway", description="Highway, Urban, Rural, Mountain")
    fuel_level_l: float = Field(default=50.0, ge=0, description="Current fuel tank level in Litres")
    fuel_rate_lph: Optional[float] = Field(default=None, description="Instantaneous fuel rate in L/h")
    idle_duration_sec: int = Field(default=0, ge=0, description="Continuous idle duration in seconds")


class TelemetryAnalysisRequest(BaseModel):
    window: List[TelemetryFrame] = Field(..., description="Telemetry frames in chronological order")
    fuel_price_inr: Optional[float] = Field(default=None, description="Optional custom fuel price in INR")


class TelemetryAlertResponse(BaseModel):
    vehicle_id: str
    behaviour: str
    severity: Literal["NORMAL", "INFO", "WARNING", "CRITICAL"]
    behaviour_score: float
    fuel_deviation_pct: float
    fuel_wasted_l: float
    estimated_cost_inr: float
    co2_impact_kg: float
    remaining_range_km: float
    refuel_required: bool
    message: str


class RangeEstimateRequest(BaseModel):
    fuel_level_l: float = Field(..., ge=0)
    expected_efficiency_kmpl: float = Field(default=4.0, gt=0)
    current_efficiency_kmpl: Optional[float] = Field(default=None, ge=0)
    vehicle_type: str = Field(default="Truck")
    fuel_capacity_l: Optional[float] = Field(default=None, gt=0)
    trip_remaining_distance_km: Optional[float] = Field(default=None, ge=0)


class RangeEstimateResponse(BaseModel):
    fuel_level_l: float
    fuel_level_pct: float
    estimated_range_km: float
    blended_efficiency_kmpl: float
    refuel_required: bool
    refuel_warning: Optional[str] = None
