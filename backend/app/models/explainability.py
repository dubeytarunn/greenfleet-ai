"""
GreenFlow AI - Explainability & Counterfactual Data Models
=========================================================
Strict schemas for deterministic vehicle-route assignment explanations,
factor decompositions, alternative comparisons, and what-if sensitivity analysis.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .simulation import CarbonBudgetStatus, ScoreBreakdown


class TargetAssignmentDetails(BaseModel):
    """Details of the assigned target vehicle and route."""
    vehicle_id: str
    vehicle_type: str
    fuel_type: str
    vehicle_age: int
    max_payload_kg: float
    route_id: str
    origin: str
    destination: str
    distance_km: float
    required_payload_kg: float
    traffic_factor: float
    priority: int
    predicted_fuel_l: float
    estimated_co2_kg: float
    fuel_lower_l: Optional[float] = None
    fuel_upper_l: Optional[float] = None
    uncertainty_l: Optional[float] = None
    uncertainty_pct: Optional[float] = None
    risk_adjusted_fuel_l: Optional[float] = None
    overall_suitability_score: float
    breakdown: ScoreBreakdown
    assignment_cost: float = Field(default=0.0, description="QUBO objective cost for this assignment")


class AlternativeVehicleDetails(BaseModel):
    """Details of the strongest feasible alternative vehicle."""
    vehicle_id: str
    vehicle_type: str
    fuel_type: str
    max_payload_kg: float
    predicted_fuel_l: float
    estimated_co2_kg: float
    fuel_lower_l: Optional[float] = None
    fuel_upper_l: Optional[float] = None
    uncertainty_l: Optional[float] = None
    risk_adjusted_fuel_l: Optional[float] = None
    overall_suitability_score: float
    breakdown: ScoreBreakdown
    assignment_cost: float = Field(default=0.0, description="QUBO objective cost for alternative assignment")
    delta_score: float = Field(..., description="Target Score - Alternative Score")
    delta_fuel_l: float = Field(..., description="Alternative Fuel - Target Fuel (positive means target is more efficient)")
    delta_co2_kg: float = Field(..., description="Alternative CO2 - Target CO2 (positive means target reduces emissions)")
    delta_cost: float = Field(..., description="Operating cost delta (Alt_Cost - Target_Cost)")



class CounterfactualInsight(BaseModel):
    """Quantitative or structural condition under which the alternative becomes optimal."""
    trigger_type: str = Field(..., description="carbon_budget | traffic_factor | risk_aversion | payload_shift | availability")
    description: str = Field(..., description="Human-readable verified counterfactual statement")
    parameter_name: str = Field(..., description="Name of modified parameter")
    current_value: float = Field(..., description="Current parameter value")
    threshold_value: Optional[float] = Field(default=None, description="Calculated crossover threshold if mathematically solvable")
    is_feasible: bool = Field(default=True, description="Whether alternative could realistically become optimal")


class CarbonContextModel(BaseModel):
    """Snapshot of Carbon Budget Governor state during optimization."""
    budget_kg: float
    consumed_kg: float
    projected_total_kg: float
    budget_utilisation_pct: float
    status: CarbonBudgetStatus
    dynamic_co2_penalty: float
    carbon_pressure_narrative: str


class RiskContextModel(BaseModel):
    """Prediction uncertainty & risk-aversion context."""
    risk_aversion_lambda: float
    target_uncertainty_l: Optional[float] = None
    target_risk_level: str = Field(default="LOW", description="LOW | MODERATE | HIGH")
    alternative_uncertainty_l: Optional[float] = None
    risk_narrative: str


class AssignmentExplanationResponse(BaseModel):
    """Complete, deterministic explainability record for a vehicle-route assignment."""
    vehicle_id: str
    route_id: str
    summary_verdict: str
    target: TargetAssignmentDetails
    has_alternative: bool
    alternative: Optional[AlternativeVehicleDetails] = None
    key_advantages: List[str]
    carbon_context: CarbonContextModel
    risk_context: Optional[RiskContextModel] = None
    counterfactuals: List[CounterfactualInsight]
    full_narrative: str
