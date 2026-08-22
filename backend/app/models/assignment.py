"""
GreenFlow AI - Prediction, Assignment & Optimization Models
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .vehicle import VehicleModel
from .route import RouteModel


class PredictionModel(BaseModel):
    """
    Fuel & CO2 forecast for a single (vehicle, route) pair with conformal prediction bounds.
    """
    vehicle_id: str
    route_id: str
    predicted_fuel_l: float = Field(..., ge=0.0, description="Predicted fuel consumption in litres")
    estimated_co2_kg: float = Field(..., ge=0.0, description="Estimated CO2 emissions in kg")
    fuel_lower_l: Optional[float] = Field(default=None, description="Lower conformal prediction bound (litres)")
    fuel_upper_l: Optional[float] = Field(default=None, description="Upper conformal prediction bound (litres)")
    uncertainty_l: Optional[float] = Field(default=None, description="Uncertainty half-width in litres")
    uncertainty_pct: Optional[float] = Field(default=None, description="Relative uncertainty percentage (%)")
    risk_adjusted_fuel_l: Optional[float] = Field(default=None, description="Risk-adjusted fuel: F_hat + lambda * uncertainty")
    confidence_level: Optional[float] = Field(default=0.90, description="Conformal coverage confidence level")
    confidence: Optional[float] = Field(default=0.95, description="Model prediction confidence score")


class ForecastRequest(BaseModel):
    """Batch or single vehicle/route forecast request."""
    vehicles: List[VehicleModel]
    routes: List[RouteModel]


class ForecastResponse(BaseModel):
    """Forecast response containing predictions matrix/list."""
    total_predictions: int
    predictions: List[PredictionModel]


class AssignmentModel(BaseModel):
    """
    Locked contract assignment representation extended with risk metrics.
    """
    vehicle_id: str
    route_id: str
    predicted_fuel_l: Optional[float] = Field(default=None, description="Fuel required in litres")
    estimated_co2_kg: Optional[float] = Field(default=None, description="CO2 emissions in kg")
    fuel_lower_l: Optional[float] = Field(default=None, description="Lower conformal bound (litres)")
    fuel_upper_l: Optional[float] = Field(default=None, description="Upper conformal bound (litres)")
    uncertainty_l: Optional[float] = Field(default=None, description="Uncertainty half-width in litres")
    uncertainty_pct: Optional[float] = Field(default=None, description="Relative uncertainty (%)")
    risk_adjusted_fuel_l: Optional[float] = Field(default=None, description="Risk-adjusted fuel consumption (litres)")
    operating_cost: Optional[float] = Field(default=None, description="Calculated operating cost ($)")
    status: str = Field(default="assigned", description="Assignment status ('assigned' or 'unassigned')")


class OptimizationConfigModel(BaseModel):
    """Hyperparameters and weights for the optimizer."""
    fuel_weight: float = Field(default=1.0, description="Weight on fuel consumption")
    co2_weight: float = Field(default=1.0, description="Weight on emissions")
    distance_weight: float = Field(default=0.3, description="Weight on distance penalty")
    risk_aversion_lambda: float = Field(default=0.5, ge=0.0, le=5.0, description="Dispatcher risk aversion lambda")
    imbalance_weight: float = Field(default=0.5, description="Weight on workload imbalance")
    capacity_shortfall_penalty: float = Field(default=5000.0, description="Penalty for insufficient vehicle capacity")
    constraint_penalty: float = Field(default=50000.0, description="Penalty for hard constraint violations")
    initial_temp: float = Field(default=1000.0, description="Simulated annealing initial temperature")
    cooling_rate: float = Field(default=0.995, description="Annealing geometric cooling schedule")
    min_temp: float = Field(default=1e-3, description="Annealing minimum temperature")
    max_iterations: int = Field(default=20000, description="Maximum solver iterations")
    seed: Optional[int] = Field(default=42, description="Random seed for reproducibility")



class OptimizeRequest(BaseModel):
    """Request payload for standalone optimizer."""
    vehicles: List[VehicleModel]
    routes: List[RouteModel]
    predictions: Optional[List[PredictionModel]] = None
    config: Optional[OptimizationConfigModel] = None
    method: str = Field(default="quantum_inspired", description="'quantum_inspired' (SA) or 'classical_baseline' (MILP/Hungarian)")


class OptimizeResponse(BaseModel):
    """Output contract returned by the optimization endpoint."""
    success: bool
    method: str
    assignments: List[AssignmentModel]
    total_predicted_fuel_l: float
    total_estimated_co2_kg: float
    total_operating_cost: float
    fleet_utilisation_pct: float
    feasible: bool
    runtime_seconds: float
    constraint_violations: List[str] = []
    error: Optional[str] = None
