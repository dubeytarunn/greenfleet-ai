"""
GreenFlow AI - Simulation Engine & State Manager
Maintains deterministic fleet state, runs lifecycle transitions,
and calculates dynamic benchmark KPIs.
"""

from datetime import datetime
import logging
from threading import Lock
from typing import Dict, List, Optional

from backend.app.core.carbon_governor import (
    CarbonBudgetGovernor,
    CarbonBudgetStatus,
    DEFAULT_SHIFT_BUDGET_KG,
)
from backend.app.core.config import settings
from backend.app.core.integration import predict_fuel_and_co2, run_greenflow_optimizer
from backend.app.models.assignment import (
    AssignmentModel,
    OptimizationConfigModel,
    PredictionModel,
)
from backend.app.models.route import RouteModel
from backend.app.models.simulation import (
    BenchmarkComparison,
    BenchmarkKPIs,
    CarbonBudgetModel,
    ScenarioType,
    SimulationStateResponse,
)
from backend.app.models.vehicle import VehicleModel
from .baseline import solve_baseline_heuristic
from .scenarios import generate_scenario

logger = logging.getLogger(__name__)


class SimulationEngine:
    """
    Central simulation state machine for GreenFlow AI.
    Guarantees thread-safe deterministic state transitions.
    """

    def __init__(self, initial_budget_kg: float = DEFAULT_SHIFT_BUDGET_KG):
        self._lock = Lock()
        self.scenario: ScenarioType = ScenarioType.NORMAL
        self.status: str = "initialized"
        self.last_updated: str = datetime.utcnow().isoformat()
        
        self.carbon_governor = CarbonBudgetGovernor(budget_kg=initial_budget_kg)
        
        self.vehicles: List[VehicleModel] = []
        self.routes: List[RouteModel] = []
        self.predictions: List[PredictionModel] = []
        
        self.baseline_assignments: List[AssignmentModel] = []
        self.greenflow_assignments: List[AssignmentModel] = []
        self.benchmark: Optional[BenchmarkComparison] = None
        
        # Initialize default state
        self.reset()

    def reset(self, budget_kg: Optional[float] = None) -> SimulationStateResponse:
        """Restores the simulation to the deterministic Normal Fleet initial state."""
        with self._lock:
            self.scenario = ScenarioType.NORMAL
            self.vehicles, self.routes = generate_scenario(ScenarioType.NORMAL)
            self.predictions = predict_fuel_and_co2(self.vehicles, self.routes)
            
            # Compute baseline assignments
            self.baseline_assignments = solve_baseline_heuristic(
                self.vehicles, self.routes, self.predictions
            )
            
            # Reset carbon governor
            self.carbon_governor.reset(budget_kg=budget_kg)
            base_kpi = self._calculate_kpis(self.baseline_assignments, "Baseline Heuristic")
            self.carbon_governor.update_from_simulation(
                consumed_co2_kg=0.0,
                projected_co2_kg=base_kpi.estimated_co2_kg,
                baseline_co2_kg=base_kpi.estimated_co2_kg,
            )
            
            # GreenFlow assignments and benchmark ready for trigger
            self.greenflow_assignments = []
            self.benchmark = None
            
            self.status = "ready (normal fleet)"
            self.last_updated = datetime.utcnow().isoformat()
            
            return self._build_state_response()

    def apply_scenario(self, scenario_type: ScenarioType, budget_kg: Optional[float] = None) -> SimulationStateResponse:
        """Applies a stress scenario (e.g. Peak Demand or High Traffic)."""
        with self._lock:
            self.scenario = scenario_type
            self.vehicles, self.routes = generate_scenario(scenario_type)
            self.predictions = predict_fuel_and_co2(self.vehicles, self.routes)
            
            # Run baseline under new scenario
            self.baseline_assignments = solve_baseline_heuristic(
                self.vehicles, self.routes, self.predictions
            )
            
            base_kpi = self._calculate_kpis(self.baseline_assignments, "Baseline Heuristic")
            if budget_kg is not None:
                self.carbon_governor.set_budget(budget_kg)
            
            self.carbon_governor.update_from_simulation(
                consumed_co2_kg=0.0,
                projected_co2_kg=base_kpi.estimated_co2_kg,
                baseline_co2_kg=base_kpi.estimated_co2_kg,
            )
            
            # Reset previous optimization until user/client runs optimizer
            self.greenflow_assignments = []
            self.benchmark = None
            
            self.status = f"scenario active: {scenario_type.value}"
            self.last_updated = datetime.utcnow().isoformat()
            
            return self._build_state_response()

    def set_carbon_budget(self, budget_kg: float) -> SimulationStateResponse:
        """Dynamically reconfigures the operational carbon budget and recalculates state."""
        with self._lock:
            self.carbon_governor.set_budget(budget_kg)
            # Recompute state with current active assignments
            active_assignments = self.greenflow_assignments if self.greenflow_assignments else self.baseline_assignments
            kpi = self._calculate_kpis(active_assignments, "Active Strategy")
            base_kpi = self._calculate_kpis(self.baseline_assignments, "Baseline Heuristic")
            self.carbon_governor.update_from_simulation(
                consumed_co2_kg=0.0,
                projected_co2_kg=kpi.estimated_co2_kg,
                baseline_co2_kg=base_kpi.estimated_co2_kg,
            )
            self.last_updated = datetime.utcnow().isoformat()
            return self._build_state_response()

    def run_optimization(
        self,
        config: Optional[OptimizationConfigModel] = None,
        method: str = "quantum_inspired",
    ) -> SimulationStateResponse:
        """
        Runs GreenFlow Quantum-Inspired Optimization on the current simulation state,
        feeding the dynamic carbon penalty weight into the optimizer,
        then evaluates and caches the dynamic benchmark comparison and updated carbon budget.
        """
        with self._lock:
            # 1. Fetch dynamic carbon penalty from governor if not explicitly overridden
            gov_state = self.carbon_governor.get_state()
            opt_config = config or OptimizationConfigModel()
            if config is None or config.co2_weight == 1.0:
                opt_config.co2_weight = gov_state.dynamic_co2_penalty
                
            # 2. Run optimization engine with dynamic carbon penalty
            opt_result = run_greenflow_optimizer(
                vehicles=self.vehicles,
                routes=self.routes,
                predictions=self.predictions,
                config=opt_config,
                method=method,
            )
            
            self.greenflow_assignments = opt_result["assignments"]
            
            # 3. Calculate dynamic KPI comparisons
            baseline_kpi = self._calculate_kpis(self.baseline_assignments, "Baseline Heuristic")
            greenflow_kpi = self._calculate_kpis(self.greenflow_assignments, "GreenFlow Quantum-Inspired")
            
            # 4. Update Carbon Budget Governor with post-optimization projected emissions
            self.carbon_governor.update_from_simulation(
                consumed_co2_kg=0.0,
                projected_co2_kg=greenflow_kpi.estimated_co2_kg,
                baseline_co2_kg=baseline_kpi.estimated_co2_kg,
            )
            
            fuel_saved = round(max(0.0, baseline_kpi.total_fuel_l - greenflow_kpi.total_fuel_l), 1)
            fuel_pct = round(
                (fuel_saved / max(baseline_kpi.total_fuel_l, 0.001)) * 100.0, 1
            )
            
            co2_saved = round(max(0.0, baseline_kpi.estimated_co2_kg - greenflow_kpi.estimated_co2_kg), 1)
            co2_pct = round(
                (co2_saved / max(baseline_kpi.estimated_co2_kg, 0.001)) * 100.0, 1
            )
            
            cost_saved = round(max(0.0, baseline_kpi.total_operating_cost - greenflow_kpi.total_operating_cost), 2)
            cost_pct = round(
                (cost_saved / max(baseline_kpi.total_operating_cost, 0.001)) * 100.0, 1
            )
            
            ineff_diff = max(
                0, baseline_kpi.inefficient_assignments_count - greenflow_kpi.inefficient_assignments_count
            )
            
            self.benchmark = BenchmarkComparison(
                scenario=self.scenario,
                timestamp=datetime.utcnow().isoformat(),
                baseline=baseline_kpi,
                greenflow=greenflow_kpi,
                fuel_saved_l=fuel_saved,
                fuel_saved_pct=fuel_pct,
                co2_reduced_kg=co2_saved,
                co2_reduced_pct=co2_pct,
                cost_saved=cost_saved,
                cost_saved_pct=cost_pct,
                inefficient_assignments_reduced=ineff_diff,
            )
            
            self.status = f"optimized ({method})"
            self.last_updated = datetime.utcnow().isoformat()
            
            return self._build_state_response()

    def get_benchmark(self) -> BenchmarkComparison:
        """Returns the latest benchmark or computes on the fly if needed."""
        with self._lock:
            if self.benchmark is not None:
                return self.benchmark
            
            # If optimization hasn't been run yet, run it automatically to return valid benchmark
            baseline_kpi = self._calculate_kpis(self.baseline_assignments, "Baseline Heuristic")
            
            # Run fast optimization for benchmark with dynamic carbon penalty
            gov_state = self.carbon_governor.get_state()
            config = OptimizationConfigModel(co2_weight=gov_state.dynamic_co2_penalty)
            
            opt_result = run_greenflow_optimizer(
                vehicles=self.vehicles,
                routes=self.routes,
                predictions=self.predictions,
                config=config,
            )
            self.greenflow_assignments = opt_result["assignments"]
            greenflow_kpi = self._calculate_kpis(self.greenflow_assignments, "GreenFlow Quantum-Inspired")
            
            # Update carbon governor
            self.carbon_governor.update_from_simulation(
                consumed_co2_kg=0.0,
                projected_co2_kg=greenflow_kpi.estimated_co2_kg,
                baseline_co2_kg=baseline_kpi.estimated_co2_kg,
            )
            
            fuel_saved = round(max(0.0, baseline_kpi.total_fuel_l - greenflow_kpi.total_fuel_l), 1)
            fuel_pct = round((fuel_saved / max(baseline_kpi.total_fuel_l, 0.001)) * 100.0, 1)
            
            co2_saved = round(max(0.0, baseline_kpi.estimated_co2_kg - greenflow_kpi.estimated_co2_kg), 1)
            co2_pct = round((co2_saved / max(baseline_kpi.estimated_co2_kg, 0.001)) * 100.0, 1)
            
            cost_saved = round(max(0.0, baseline_kpi.total_operating_cost - greenflow_kpi.total_operating_cost), 2)
            cost_pct = round((cost_saved / max(baseline_kpi.total_operating_cost, 0.001)) * 100.0, 1)
            
            ineff_diff = max(
                0, baseline_kpi.inefficient_assignments_count - greenflow_kpi.inefficient_assignments_count
            )
            
            self.benchmark = BenchmarkComparison(
                scenario=self.scenario,
                timestamp=datetime.utcnow().isoformat(),
                baseline=baseline_kpi,
                greenflow=greenflow_kpi,
                fuel_saved_l=fuel_saved,
                fuel_saved_pct=fuel_pct,
                co2_reduced_kg=co2_saved,
                co2_reduced_pct=co2_pct,
                cost_saved=cost_saved,
                cost_saved_pct=cost_pct,
                inefficient_assignments_reduced=ineff_diff,
            )
            return self.benchmark

    def get_state(self) -> SimulationStateResponse:
        """Returns the current state response."""
        with self._lock:
            return self._build_state_response()

    def _calculate_kpis(self, assignments: List[AssignmentModel], strategy_name: str) -> BenchmarkKPIs:
        """Calculates dynamic operational metrics for a set of assignments."""
        valid_assignments = [a for a in assignments if a.status == "assigned" and a.predicted_fuel_l is not None]
        
        total_fuel = sum(a.predicted_fuel_l for a in valid_assignments)
        total_co2 = sum(a.estimated_co2_kg for a in valid_assignments if a.estimated_co2_kg is not None)
        total_cost = sum(a.operating_cost for a in valid_assignments if a.operating_cost is not None)
        
        available_vehicles_count = sum(1 for v in self.vehicles if v.available)
        assigned_count = len(valid_assignments)
        total_routes_count = len(self.routes)
        
        utilisation = (assigned_count / max(available_vehicles_count, 1)) * 100.0
        avg_fuel = total_fuel / max(assigned_count, 1)
        
        # Calculate inefficient assignments dynamically:
        # For each assigned route, find the minimum feasible fuel across all available vehicles.
        # If the assignment exceeds 1.35x of minimum feasible fuel, it counts as inefficient.
        inefficient_count = 0
        pred_map = {(p.vehicle_id, p.route_id): p.predicted_fuel_l for p in self.predictions}
        v_map = {v.vehicle_id: v for v in self.vehicles}
        r_map = {r.route_id: r for r in self.routes}
        
        for a in valid_assignments:
            route = r_map.get(a.route_id)
            if not route:
                continue
            # Find minimum fuel for this route among available vehicles with enough capacity
            feasible_fuels = [
                pred_map.get((v.vehicle_id, a.route_id), 999.0)
                for v in self.vehicles
                if v.available and v.max_payload_kg >= route.required_payload_kg
            ]
            if feasible_fuels:
                min_fuel = min(feasible_fuels)
                if a.predicted_fuel_l > (min_fuel * settings.INEFFICIENCY_THRESHOLD_RATIO):
                    inefficient_count += 1
        
        return BenchmarkKPIs(
            strategy_name=strategy_name,
            total_fuel_l=round(total_fuel, 1),
            estimated_co2_kg=round(total_co2, 1),
            total_operating_cost=round(total_cost, 2),
            fleet_utilisation_pct=round(utilisation, 1),
            assigned_routes_count=assigned_count,
            total_routes_count=total_routes_count,
            inefficient_assignments_count=inefficient_count,
            average_fuel_per_route_l=round(avg_fuel, 1),
        )

    def _build_state_response(self) -> SimulationStateResponse:
        gov_state = self.carbon_governor.get_state()
        carbon_model = CarbonBudgetModel(**gov_state.model_dump())
        return SimulationStateResponse(
            scenario=self.scenario,
            status=self.status,
            timestamp=self.last_updated,
            vehicles_count=len(self.vehicles),
            routes_count=len(self.routes),
            vehicles=self.vehicles,
            routes=self.routes,
            baseline_assignments=self.baseline_assignments,
            greenflow_assignments=self.greenflow_assignments,
            benchmark=self.benchmark,
            carbon_budget=carbon_model,
        )



# Global singleton instance
simulation_engine = SimulationEngine()
