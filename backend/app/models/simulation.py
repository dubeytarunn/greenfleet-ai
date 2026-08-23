"""
GreenFlow AI - Simulation, Scoring & Benchmark Models
"""

from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .vehicle import VehicleModel
from .route import RouteModel
from .assignment import AssignmentModel, PredictionModel


class ScenarioType(str, Enum):
    NORMAL = "normal"
    PEAK_DEMAND = "peak_demand"
    HIGH_TRAFFIC = "high_traffic"


class ScoreBreakdown(BaseModel):
    """Explainable factor-level scores (each normalized 0 - 100, higher is better)."""
    fuel_efficiency: float = Field(..., description="Powertrain efficiency suitability")
    capacity_match: float = Field(..., description="Payload capacity alignment (penalizes overload or excessive overkill)")
    distance_suitability: float = Field(..., description="Range & wear suitability for distance")
    traffic_resilience: float = Field(..., description="Resilience to stop-and-go congestion")
    availability: float = Field(..., description="Current vehicle readiness")


class VehicleRouteScore(BaseModel):
    """Vehicle-to-route explainable scoring record."""
    vehicle_id: str
    route_id: str
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Composite suitability score (0-100)")
    breakdown: ScoreBreakdown
    recommendation: str = Field(default="Compatible", description="Qualitative suitability label")


class ScoringRequest(BaseModel):
    vehicles: List[VehicleModel]
    routes: List[RouteModel]


class ScoringResponse(BaseModel):
    total_scores: int
    scores: List[VehicleRouteScore]


class BenchmarkKPIs(BaseModel):
    """Calculated operational metrics for a specific strategy."""
    strategy_name: str = Field(..., description="Name of strategy (e.g. Baseline Heuristic, GreenFlow Quantum-Inspired)")
    total_fuel_l: float = Field(..., description="Total fuel consumed in litres")
    estimated_co2_kg: float = Field(..., description="Total estimated CO2 emissions in kg")
    total_operating_cost: float = Field(..., description="Total fleet operating cost in $")
    fleet_utilisation_pct: float = Field(..., description="Percentage of available vehicles actively assigned")
    assigned_routes_count: int = Field(..., description="Number of routes successfully assigned")
    total_routes_count: int = Field(..., description="Total routes requiring dispatch")
    inefficient_assignments_count: int = Field(..., description="Number of suboptimal or high-emission assignments")
    average_fuel_per_route_l: float = Field(..., description="Mean fuel per completed route")


class BenchmarkComparison(BaseModel):
    """Side-by-side comparison of Baseline vs GreenFlow."""
    scenario: ScenarioType
    timestamp: str
    baseline: BenchmarkKPIs
    greenflow: BenchmarkKPIs
    fuel_saved_l: float = Field(..., description="Total fuel saved (Baseline - GreenFlow)")
    fuel_saved_pct: float = Field(..., description="Percentage fuel reduction achieved")
    co2_reduced_kg: float = Field(..., description="Total estimated CO2 reduction in kg")
    co2_reduced_pct: float = Field(..., description="Percentage CO2 reduction achieved")
    cost_saved: float = Field(..., description="Total operating cost savings in $")
    cost_saved_pct: float = Field(..., description="Percentage cost savings achieved")
    inefficient_assignments_reduced: int = Field(..., description="Reduction in inefficient vehicle-route pairings")


class CarbonBudgetStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    OVER_BUDGET = "OVER_BUDGET"


class CarbonBudgetModel(BaseModel):
    """Operational Carbon Budget State."""
    budget_kg: float = Field(..., description="Total fleet carbon quota in kg CO2")
    consumed_kg: float = Field(default=0.0, description="Realised CO2 emissions from completed trips (kg)")
    projected_kg: float = Field(default=0.0, description="Expected future CO2 emissions from planned routes (kg)")
    projected_total_kg: float = Field(default=0.0, description="Total expected emissions (consumed + projected)")
    remaining_budget_kg: float = Field(default=0.0, description="Net remaining budget in kg")
    budget_headroom_kg: float = Field(default=0.0, description="Safe headroom before exceeding budget (kg)")
    budget_utilisation_pct: float = Field(default=0.0, description="Budget consumption percentage")
    status: CarbonBudgetStatus = Field(default=CarbonBudgetStatus.HEALTHY, description="Operational carbon status")
    dynamic_co2_penalty: float = Field(default=1.0, description="Dynamic multiplier w_co2 for optimizer cost matrix")
    co2_avoided_kg: float = Field(default=0.0, description="CO2 saved vs uncoordinated baseline (kg)")
    hard_cap_enabled: bool = Field(default=False, description="If true, optimizer enforces budget_kg as a hard constraint")


class SimulationStateResponse(BaseModel):
    """Full snapshot of the simulation environment."""
    scenario: ScenarioType
    status: str
    timestamp: str
    vehicles_count: int
    routes_count: int
    vehicles: List[VehicleModel]
    routes: List[RouteModel]
    baseline_assignments: List[AssignmentModel]
    greenflow_assignments: List[AssignmentModel]
    benchmark: Optional[BenchmarkComparison] = None
    carbon_budget: Optional[CarbonBudgetModel] = None
