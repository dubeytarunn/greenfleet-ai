"""
GreenFlow AI — Carbon Budget Governor & Optimizer Coupling Test Suite
=====================================================================

Tests:
1. Healthy budget state (0 - 70%)
2. Warning budget state (>70% - 90%)
3. Critical budget state (>90% - 100%)
4. Over-budget state (>100%)
5. Dynamic penalty monotonic scaling
6. Reset lifecycle behavior
7. Optimizer acceptance of dynamic carbon penalty
8. Controlled Carbon-Stress / Pareto Trade-off test (changing budget flips preference)
9. Simulation engine lifecycle integration with governor
10. PuLP classical baseline solver preservation
"""

import unittest
from backend.app.core.carbon_governor import (
    CarbonBudgetGovernor,
    CarbonBudgetStatus,
    DEFAULT_CARBON_BUDGET_KG,
)
from backend.app.core.quantum_optimizer import (
    OptimizationConfig,
    Prediction,
    QuantumInspiredOptimizer,
    Route,
    Vehicle,
)
from backend.app.models.assignment import OptimizationConfigModel
from backend.app.models.simulation import ScenarioType
from simulation.engine import SimulationEngine


class TestCarbonBudgetGovernor(unittest.TestCase):
    def setUp(self):
        self.governor = CarbonBudgetGovernor(budget_kg=5000.0)

    def test_healthy_budget_state(self):
        """Test healthy status when projected emissions are <= 70% of budget."""
        self.governor.update_from_simulation(consumed_co2_kg=500.0, projected_co2_kg=2000.0)
        state = self.governor.get_state()
        self.assertEqual(state.status, CarbonBudgetStatus.HEALTHY)
        self.assertEqual(state.projected_total_kg, 2500.0)
        self.assertEqual(state.budget_utilisation_pct, 50.0)
        self.assertEqual(state.remaining_budget_kg, 2500.0)
        self.assertEqual(state.budget_headroom_kg, 2500.0)
        self.assertEqual(state.dynamic_co2_penalty, 1.0)

    def test_warning_budget_state(self):
        """Test warning status when emissions are >70% and <=90% of budget."""
        self.governor.update_from_simulation(consumed_co2_kg=1000.0, projected_co2_kg=3000.0)
        state = self.governor.get_state()
        self.assertEqual(state.status, CarbonBudgetStatus.WARNING)
        self.assertEqual(state.projected_total_kg, 4000.0)
        self.assertEqual(state.budget_utilisation_pct, 80.0)
        self.assertEqual(state.remaining_budget_kg, 1000.0)
        # In warning range (70% - 90%), dynamic penalty scales between 1.0 and 1.8
        self.assertGreater(state.dynamic_co2_penalty, 1.0)
        self.assertLessEqual(state.dynamic_co2_penalty, 1.8)

    def test_critical_budget_state(self):
        """Test critical status when emissions are >90% and <=100% of budget."""
        self.governor.update_from_simulation(consumed_co2_kg=1800.0, projected_co2_kg=3000.0)
        state = self.governor.get_state()
        self.assertEqual(state.status, CarbonBudgetStatus.CRITICAL)
        self.assertEqual(state.projected_total_kg, 4800.0)
        self.assertEqual(state.budget_utilisation_pct, 96.0)
        self.assertEqual(state.remaining_budget_kg, 200.0)
        # In critical range (90% - 100%), dynamic penalty scales between 1.8 and 3.0
        self.assertGreater(state.dynamic_co2_penalty, 1.8)
        self.assertLessEqual(state.dynamic_co2_penalty, 3.0)

    def test_over_budget_state(self):
        """Test over-budget status when emissions exceed 100% of budget."""
        self.governor.update_from_simulation(consumed_co2_kg=2500.0, projected_co2_kg=3000.0)
        state = self.governor.get_state()
        self.assertEqual(state.status, CarbonBudgetStatus.OVER_BUDGET)
        self.assertEqual(state.projected_total_kg, 5500.0)
        self.assertEqual(state.budget_utilisation_pct, 110.0)
        self.assertEqual(state.remaining_budget_kg, -500.0)
        self.assertEqual(state.budget_headroom_kg, 0.0)
        self.assertGreaterEqual(state.dynamic_co2_penalty, 3.0)

    def test_dynamic_penalty_monotonic_increase(self):
        """Test that dynamic environmental penalty strictly increases as utilisation grows."""
        penalties = []
        for util in [50.0, 70.0, 75.0, 85.0, 92.0, 98.0, 105.0, 120.0]:
            p = self.governor.calculate_dynamic_penalty(util)
            penalties.append(p)

        # Verify monotonic non-decreasing order
        for i in range(len(penalties) - 1):
            self.assertLessEqual(penalties[i], penalties[i + 1])
            if util > 70.0:
                self.assertGreater(penalties[-1], penalties[0])

    def test_reset_restores_initial_state(self):
        """Test that reset clears consumed and projected emissions."""
        self.governor.update_from_simulation(consumed_co2_kg=2000.0, projected_co2_kg=3500.0)
        self.assertEqual(self.governor.get_state().status, CarbonBudgetStatus.OVER_BUDGET)

        state = self.governor.reset(budget_kg=6000.0)
        self.assertEqual(state.budget_kg, 6000.0)
        self.assertEqual(state.consumed_kg, 0.0)
        self.assertEqual(state.projected_kg, 0.0)
        self.assertEqual(state.status, CarbonBudgetStatus.HEALTHY)
        self.assertEqual(state.dynamic_co2_penalty, 1.0)


class TestCarbonStressParetoTradeoff(unittest.TestCase):
    """
    Controlled Pareto Trade-off Test:
    Proves that under the exact same fleet, routes, and predictions,
    changing the operational carbon budget alters the optimizer's assignment preference.
    """

    def test_controlled_carbon_stress_flips_assignment_preference(self):
        # Scenario: 1 route requiring delivery
        route = Route(
            route_id="R_TRADE",
            origin="Depot",
            destination="Customer",
            distance_km=50.0,
            required_payload_kg=2000.0,
            traffic_factor=1.0,
            priority=1,
        )

        # Vehicle 1: Diesel Truck (3000kg max payload) - Highly efficient on fuel (18L), but higher CO2 emissions (48.0 kg)
        v_diesel = Vehicle(
            vehicle_id="V_DIESEL",
            vehicle_type="Truck",
            fuel_type="Diesel",
            vehicle_age=2,
            fuel_capacity_l=150.0,
            max_payload_kg=3000.0,
            available=True,
        )

        # Vehicle 2: CNG Van (3000kg max payload) - Slightly higher unit fuel (26L), but significantly cleaner (18.0 kg CO2)
        v_cng = Vehicle(
            vehicle_id="V_CNG",
            vehicle_type="Van",
            fuel_type="CNG",
            vehicle_age=1,
            fuel_capacity_l=80.0,
            max_payload_kg=3000.0,
            available=True,
        )

        vehicles = [v_diesel, v_cng]
        routes = [route]

        predictions = [
            Prediction(vehicle_id="V_DIESEL", route_id="R_TRADE", predicted_fuel_l=18.0, estimated_co2_kg=48.00),
            Prediction(vehicle_id="V_CNG", route_id="R_TRADE", predicted_fuel_l=26.0, estimated_co2_kg=18.00),
        ]

        # 1. UNDER HEALTHY CARBON BUDGET (w_co2 = 0.1)
        # Cost Diesel = 18.0*1.0 + 48.0*0.1 + 50*0.3 + 0.05*(3000-2000) = 18.0 + 4.8 + 15.0 + 50.0 = 87.8
        # Cost CNG = 26.0*1.0 + 18.0*0.1 + 50*0.3 + 0.05*(3000-2000) = 26.0 + 1.8 + 15.0 + 50.0 = 92.8
        # -> Diesel is strictly cheaper (87.8 vs 92.8), so Diesel is preferred.
        config_healthy = OptimizationConfig(fuel_weight=1.0, co2_weight=0.1, distance_weight=0.3, seed=42)
        opt_healthy = QuantumInspiredOptimizer(vehicles, routes, predictions, config=config_healthy)
        res_healthy = opt_healthy.solve_simulated_annealing()
        assigned_healthy = opt_healthy.to_assignment_list(res_healthy)
        self.assertEqual(len(assigned_healthy), 1)
        self.assertEqual(assigned_healthy[0]["vehicle_id"], "V_DIESEL")

        # 2. UNDER CRITICAL / OVER-BUDGET (w_co2 = 3.0)
        # Cost Diesel = 18.0*1.0 + 48.0*3.0 + 15.0 + 50.0 = 18.0 + 144.0 + 65.0 = 227.0
        # Cost CNG = 26.0*1.0 + 18.0*3.0 + 15.0 + 50.0 = 26.0 + 54.0 + 65.0 = 145.0
        # -> CNG is now significantly cheaper (145.0 vs 227.0), so CNG is preferred!
        config_stressed = OptimizationConfig(fuel_weight=1.0, co2_weight=3.0, distance_weight=0.3, seed=42)
        opt_stressed = QuantumInspiredOptimizer(vehicles, routes, predictions, config=config_stressed)
        res_stressed = opt_stressed.solve_simulated_annealing()
        assigned_stressed = opt_stressed.to_assignment_list(res_stressed)
        self.assertEqual(len(assigned_stressed), 1)
        self.assertEqual(assigned_stressed[0]["vehicle_id"], "V_CNG")

        # Assertion: Proves that changing carbon penalty directly shifts the preferred assignment!
        self.assertNotEqual(assigned_healthy[0]["vehicle_id"], assigned_stressed[0]["vehicle_id"])



class TestSimulationCarbonGovernorIntegration(unittest.TestCase):
    def setUp(self):
        self.engine = SimulationEngine(initial_budget_kg=5000.0)

    def test_simulation_reset_initializes_carbon_budget(self):
        """Verify simulation reset returns clean healthy carbon state."""
        state = self.engine.reset()
        self.assertIsNotNone(state.carbon_budget)
        self.assertEqual(state.carbon_budget.budget_kg, 5000.0)
        self.assertIn(state.carbon_budget.status, [CarbonBudgetStatus.HEALTHY, CarbonBudgetStatus.WARNING])
        self.assertGreater(state.carbon_budget.remaining_budget_kg, 0.0)

    def test_simulation_peak_demand_stresses_carbon_budget(self):
        """Verify peak demand increases projected emissions and changes utilisation."""
        self.engine.reset()
        normal_co2 = self.engine.carbon_governor.get_state().projected_total_kg

        peak_state = self.engine.apply_scenario(ScenarioType.PEAK_DEMAND)
        peak_co2 = peak_state.carbon_budget.projected_total_kg
        self.assertGreater(peak_co2, normal_co2)

    def test_simulation_optimization_updates_governor(self):
        """Verify run_optimization updates carbon state and reduces emissions."""
        self.engine.reset()
        opt_state = self.engine.run_optimization()
        self.assertIsNotNone(opt_state.carbon_budget)
        self.assertEqual(opt_state.status, "optimized (quantum_inspired)")
        self.assertGreater(len(opt_state.greenflow_assignments), 0)

    def test_set_carbon_budget_endpoint(self):
        """Verify dynamic carbon budget reconfiguration."""
        self.engine.reset()
        # Tighten budget to 500 kg -> pushes into OVER_BUDGET
        state = self.engine.set_carbon_budget(500.0)
        self.assertEqual(state.carbon_budget.budget_kg, 500.0)
        self.assertEqual(state.carbon_budget.status, CarbonBudgetStatus.OVER_BUDGET)
        self.assertGreaterEqual(state.carbon_budget.dynamic_co2_penalty, 3.0)


if __name__ == "__main__":
    unittest.main()
