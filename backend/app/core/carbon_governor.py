"""
GreenFlow AI — Operational Carbon Budget Governor
=================================================

Owner: Person 1 (Tech Lead / Integrator)
File:  backend/app/core/carbon_governor.py

Purpose:
Acts as an adaptive carbon-aware decision layer that tracks fleet carbon quotas
over an operational planning window and calculates a dynamic environmental
weight w_co2(B) to steer the Quantum-Inspired Simulated Annealing optimizer.

Key Distinction of Terms:
- consumed_kg:        Realised emissions from already completed / dispatched routes.
- projected_kg:       Projected future emissions from pending / assigned routes.
- projected_total_kg: Total expected emissions across planning horizon (consumed + projected).
- remaining_budget_kg: Net carbon quota remaining (budget - projected_total).
- budget_headroom_kg: Positive margin before exceeding budget (max(0, remaining_budget)).
- budget_utilisation_pct: (projected_total / budget) * 100.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CarbonBudgetStatus(str, Enum):
    HEALTHY = "HEALTHY"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    OVER_BUDGET = "OVER_BUDGET"


# Default operational thresholds for Demonstration / PoC
CARBON_WARNING_THRESHOLD: float = 0.70      # 70% utilisation
CARBON_CRITICAL_THRESHOLD: float = 0.90     # 90% utilisation
CARBON_OVER_BUDGET_THRESHOLD: float = 1.00  # 100% utilisation

# Default operational shift planning horizon budget (configurable per fleet/scenario)
DEFAULT_SHIFT_BUDGET_KG: float = 1500.0
DEFAULT_CARBON_BUDGET_KG: float = DEFAULT_SHIFT_BUDGET_KG


class CarbonBudgetState(BaseModel):
    """Immutable snapshot of the operational carbon budget."""
    budget_kg: float = Field(..., description="Total fleet carbon quota in kg CO2")
    consumed_kg: float = Field(default=0.0, description="Realised CO2 emissions from completed trips (kg)")
    projected_kg: float = Field(default=0.0, description="Expected future CO2 emissions from planned routes (kg)")
    projected_total_kg: float = Field(default=0.0, description="Total expected emissions (consumed + projected)")
    remaining_budget_kg: float = Field(default=0.0, description="Net remaining budget in kg (budget - projected_total)")
    budget_headroom_kg: float = Field(default=0.0, description="Safe headroom before exceeding budget (kg)")
    budget_utilisation_pct: float = Field(default=0.0, description="Budget consumption percentage")
    status: CarbonBudgetStatus = Field(default=CarbonBudgetStatus.HEALTHY, description="Operational carbon status")
    dynamic_co2_penalty: float = Field(default=1.0, description="Dynamic multiplier w_co2 for optimizer cost matrix")
    co2_avoided_kg: float = Field(default=0.0, description="CO2 saved vs uncoordinated baseline (kg)")


class CarbonBudgetGovernor:
    """
    Adaptive Carbon Budget Governor.
    Maintains fleet carbon accounting and dynamically scales optimizer environmental weights.
    """

    def __init__(
        self,
        budget_kg: float = DEFAULT_CARBON_BUDGET_KG,
        warning_threshold: float = CARBON_WARNING_THRESHOLD,
        critical_threshold: float = CARBON_CRITICAL_THRESHOLD,
    ):
        self.budget_kg: float = float(budget_kg)
        self.warning_threshold: float = float(warning_threshold)
        self.critical_threshold: float = float(critical_threshold)

        self.consumed_kg: float = 0.0
        self.projected_kg: float = 0.0
        self.co2_avoided_kg: float = 0.0

    def reset(self, budget_kg: Optional[float] = None) -> CarbonBudgetState:
        """Restores governor to initial baseline state."""
        if budget_kg is not None:
            self.budget_kg = float(budget_kg)
        self.consumed_kg = 0.0
        self.projected_kg = 0.0
        self.co2_avoided_kg = 0.0
        return self.get_state()

    def set_budget(self, budget_kg: float) -> None:
        """Dynamically reconfigures the planning budget."""
        if budget_kg <= 0:
            raise ValueError("Carbon budget must be strictly positive.")
        self.budget_kg = float(budget_kg)

    @staticmethod
    def calculate_consumed(assignments: List[Any]) -> float:
        """Sums realised emissions from completed assignments."""
        total = 0.0
        for a in assignments:
            # Check for completed / realised status if present
            status = getattr(a, "status", None) or (a.get("status") if isinstance(a, dict) else None)
            co2 = getattr(a, "estimated_co2_kg", None) or (a.get("estimated_co2_kg") if isinstance(a, dict) else 0.0)
            if status == "completed" and co2 is not None:
                total += float(co2)
        return round(total, 2)

    @staticmethod
    def calculate_projected(assignments: List[Any]) -> float:
        """Sums expected future emissions from active / planned assignments."""
        total = 0.0
        for a in assignments:
            status = getattr(a, "status", None) or (a.get("status") if isinstance(a, dict) else None)
            co2 = getattr(a, "estimated_co2_kg", None) or (a.get("estimated_co2_kg") if isinstance(a, dict) else 0.0)
            if status in ("assigned", "in_transit", "planned", None) and co2 is not None:
                total += float(co2)
        return round(total, 2)

    def calculate_remaining(self, budget_kg: float, projected_total_kg: float) -> float:
        """Calculates net remaining budget (can be negative if over budget)."""
        return round(budget_kg - projected_total_kg, 2)

    def calculate_utilisation(self, budget_kg: float, projected_total_kg: float) -> float:
        """Calculates budget utilisation percentage."""
        if budget_kg <= 0:
            return 100.0
        return round((projected_total_kg / budget_kg) * 100.0, 1)

    def determine_status(self, utilisation_pct: float) -> CarbonBudgetStatus:
        """
        Determines categorical status based on operational demonstration thresholds:
        - 0% - 70%: HEALTHY
        - >70% - 90%: WARNING
        - >90% - 100%: CRITICAL
        - >100%: OVER_BUDGET
        """
        ratio = utilisation_pct / 100.0
        if ratio <= self.warning_threshold:
            return CarbonBudgetStatus.HEALTHY
        elif ratio <= self.critical_threshold:
            return CarbonBudgetStatus.WARNING
        elif ratio <= CARBON_OVER_BUDGET_THRESHOLD:
            return CarbonBudgetStatus.CRITICAL
        else:
            return CarbonBudgetStatus.OVER_BUDGET

    def calculate_dynamic_penalty(self, utilisation_pct: float) -> float:
        """
        Calibrated Dynamic CO2 Weight Formula:
        Scales w_co2 smoothly based on budget utilisation to steer optimizer decisions
        without overwhelming fuel (w=1.0), distance (w=0.3), or hard constraint penalties (1e8).

        - HEALTHY (u <= 70%):     w_co2 = 1.0 (balanced baseline)
        - WARNING (70% < u <= 90%): w_co2 = 1.0 -> 1.8 (moderate carbon emphasis)
        - CRITICAL (90% < u <= 100%): w_co2 = 1.8 -> 3.0 (strong carbon emphasis)
        - OVER_BUDGET (u > 100%):  w_co2 = 3.0 -> 5.0 (dominant carbon minimization)
        """
        ratio = utilisation_pct / 100.0

        if ratio <= self.warning_threshold:
            # Healthy: Standard environmental baseline
            return 1.0
        elif ratio <= self.critical_threshold:
            # Warning: Linearly interpolate from 1.0 to 1.8
            t = (ratio - self.warning_threshold) / (self.critical_threshold - self.warning_threshold)
            return round(1.0 + (0.8 * t), 2)
        elif ratio <= CARBON_OVER_BUDGET_THRESHOLD:
            # Critical: Linearly interpolate from 1.8 to 3.0
            t = (ratio - self.critical_threshold) / (CARBON_OVER_BUDGET_THRESHOLD - self.critical_threshold)
            return round(1.8 + (1.2 * t), 2)
        else:
            # Over Budget: Aggressive carbon penalty scaling from 3.0 to 5.0
            overage = ratio - CARBON_OVER_BUDGET_THRESHOLD
            penalty = 3.0 + min(2.0, overage * 4.0)
            return round(penalty, 2)

    def update_from_simulation(
        self,
        consumed_co2_kg: float,
        projected_co2_kg: float,
        baseline_co2_kg: Optional[float] = None,
    ) -> CarbonBudgetState:
        """Updates internal governor tracking from simulation lifecycle execution."""
        self.consumed_kg = max(0.0, round(float(consumed_co2_kg), 2))
        self.projected_kg = max(0.0, round(float(projected_co2_kg), 2))
        
        projected_total = self.consumed_kg + self.projected_kg
        if baseline_co2_kg is not None:
            self.co2_avoided_kg = max(0.0, round(float(baseline_co2_kg) - projected_total, 2))

        return self.get_state()

    def get_state(self) -> CarbonBudgetState:
        """Generates the current CarbonBudgetState snapshot."""
        projected_total = round(self.consumed_kg + self.projected_kg, 2)
        remaining = self.calculate_remaining(self.budget_kg, projected_total)
        headroom = max(0.0, remaining)
        utilisation = self.calculate_utilisation(self.budget_kg, projected_total)
        status = self.determine_status(utilisation)
        dynamic_penalty = self.calculate_dynamic_penalty(utilisation)

        return CarbonBudgetState(
            budget_kg=self.budget_kg,
            consumed_kg=self.consumed_kg,
            projected_kg=self.projected_kg,
            projected_total_kg=projected_total,
            remaining_budget_kg=remaining,
            budget_headroom_kg=headroom,
            budget_utilisation_pct=utilisation,
            status=status,
            dynamic_co2_penalty=dynamic_penalty,
            co2_avoided_kg=self.co2_avoided_kg,
        )


# Global singleton governor instance (initialized with default 5000 kg budget)
carbon_governor = CarbonBudgetGovernor()
