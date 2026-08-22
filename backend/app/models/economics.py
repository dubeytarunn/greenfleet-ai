"""
GreenFlow AI - Commercial Economics & Decision Support Data Models
==================================================================
Strict schemas for configurable fuel pricing, internal carbon shadow valuation,
rule-based dispatcher recommendations, what-if projections, and scenario planning.
"""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .simulation import ScenarioType, CarbonBudgetStatus


class FuelPricingConfig(BaseModel):
    """Configurable regional fuel price assumptions (in INR ₹)."""
    diesel_price_per_l: float = Field(default=94.0, description="Diesel price per litre in INR")
    petrol_price_per_l: float = Field(default=102.0, description="Petrol price per litre in INR")
    cng_price_per_kg: float = Field(default=85.0, description="CNG price per kg in INR")
    electric_price_per_kwh: float = Field(default=8.5, description="Electricity price per kWh in INR")
    default_price_per_l: float = Field(default=95.0, description="Default fallback price per litre in INR")

    def get_price_for_fuel(self, fuel_type: str) -> float:
        """Returns the appropriate per-unit price for a vehicle fuel type."""
        f_lower = (fuel_type or "").lower()
        if "diesel" in f_lower:
            return self.diesel_price_per_l
        if "petrol" in f_lower or "gasoline" in f_lower:
            return self.petrol_price_per_l
        if "cng" in f_lower or "gas" in f_lower:
            return self.cng_price_per_kg
        if "electric" in f_lower or "ev" in f_lower:
            return self.electric_price_per_kwh
        return self.default_price_per_l


class CarbonPricingConfig(BaseModel):
    """Configurable internal corporate carbon valuation (in INR ₹)."""
    internal_shadow_price_per_tonne: float = Field(
        default=2500.0,
        description="Internal carbon shadow price per metric tonne CO2e in INR (e.g. ₹2,500/tonne = ₹2.50/kg)"
    )

    @property
    def shadow_price_per_kg(self) -> float:
        return self.internal_shadow_price_per_tonne / 1000.0


class EconomicSavingsBreakdown(BaseModel):
    """Differentiated economic impact statement for a single shift."""
    baseline_fuel_cost: float = Field(..., description="Estimated baseline fuel spend in INR")
    greenflow_fuel_cost: float = Field(..., description="Estimated GreenFlow fuel spend in INR")
    direct_fuel_cost_saved: float = Field(..., description="Direct cash fuel cost saved in INR")
    fuel_saved_pct: float = Field(..., description="Percentage reduction in fuel spend")
    
    baseline_co2_kg: float = Field(..., description="Baseline CO2 emissions in kg")
    greenflow_co2_kg: float = Field(..., description="GreenFlow CO2 emissions in kg")
    co2_avoided_kg: float = Field(..., description="Emissions avoided in kg")
    
    internal_shadow_price_per_tonne: float = Field(..., description="Active internal carbon shadow price in INR/t")
    avoided_carbon_shadow_value: float = Field(
        ..., description="Internal corporate valuation of avoided emissions (CO2_kg * Price_per_kg) in INR"
    )
    
    combined_economic_impact: float = Field(
        ..., description="Direct fuel savings + Avoided carbon shadow value in INR (qualified internal metric)"
    )
    disclaimer: str = Field(
        default="Simulated / Illustrative benchmark performance",
        description="Viva and audit qualification statement"
    )


class ActionableRecommendation(BaseModel):
    """Dynamic rule-based dispatcher recommendation answering 'What Should I Do?'."""
    urgency_level: str = Field(..., description="INFO | CAUTION | ACTION_REQUIRED")
    status_badge: str = Field(..., description="Human-readable scenario / carbon quota summary")
    problem_diagnosis: str = Field(..., description="Executive problem diagnosis from current fleet state")
    recommended_action: str = Field(..., description="Actionable dispatcher assignment recommendation")
    expected_impact: Dict[str, str] = Field(..., description="Key expected impact metrics (CO2 avoided, fuel saved, savings)")
    quota_utilisation_pct: float
    carbon_status: CarbonBudgetStatus
    disclaimer: str = Field(default="Simulated / Illustrative benchmark recommendation")


class WhatIfRequest(BaseModel):
    """4-parameter interactive what-if planning simulator inputs."""
    carbon_budget_kg: float = Field(default=1500.0, ge=500.0, le=5000.0, description="Target shift carbon budget quota in kg")
    traffic_factor_multiplier: float = Field(default=1.0, ge=0.5, le=2.5, description="Traffic congestion multiplier")
    risk_aversion_lambda: float = Field(default=0.5, ge=0.0, le=2.0, description="Dispatcher prediction risk aversion")
    diesel_price_per_l: float = Field(default=94.0, ge=50.0, le=200.0, description="Assumed diesel price in INR/L")


class WhatIfProjection(BaseModel):
    """Side-by-side comparison of Current Plan vs What-If Projected Plan."""
    current_fuel_l: float
    projected_fuel_l: float
    fuel_delta_l: float
    
    current_co2_kg: float
    projected_co2_kg: float
    co2_delta_kg: float
    
    current_fuel_cost: float
    projected_fuel_cost: float
    cost_delta: float
    
    current_carbon_utilisation_pct: float
    projected_carbon_utilisation_pct: float
    projected_carbon_status: CarbonBudgetStatus
    
    reassigned_routes_count: int
    summary_verdict: str
    disclaimer: str = Field(default="Simulated / Illustrative what-if projection (non-mutating)")


class ScenarioComparisonRecord(BaseModel):
    """Single row in the multi-scenario comparison matrix."""
    scenario_name: str
    scenario_key: str
    total_fuel_l: float
    total_co2_kg: float
    direct_fuel_cost: float
    carbon_quota_kg: float
    quota_utilisation_pct: float
    carbon_status: CarbonBudgetStatus
    fleet_utilisation_pct: float
    assigned_routes_count: int


class ScenarioMatrixResponse(BaseModel):
    """Multi-scenario comparative planning matrix."""
    scenarios: List[ScenarioComparisonRecord]
    active_scenario_key: str
    disclaimer: str = Field(default="Simulated benchmark comparison across standard operational scenarios")
