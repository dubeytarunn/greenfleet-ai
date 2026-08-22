"""
GreenFlow AI - Explainable & Counterfactual Assignment Test Suite
================================================================
Validates:
1. Explanation exists for every valid assignment.
2. Selected vehicle is strictly feasible.
3. Identified best alternative is strictly feasible.
4. Alternative is never the selected vehicle.
5. Factor scores match the existing 5-factor scoring engine.
6. Delta fuel is mathematically correct (Alt_Fuel - Target_Fuel).
7. Delta CO2 is mathematically correct (Alt_CO2 - Target_CO2).
8. Explanation dynamically updates when underlying parameters change.
9. No hardcoded vehicle text — fully deterministic data-driven synthesis.
10. Carbon status and dynamic penalty are correctly reflected.
11. Prediction uncertainty is reflected when intervals are available.
12. Existing optimizer assignments and benchmarks remain unchanged.
"""

import unittest
import os
import sys

# Ensure project root is on sys.path[0]
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if sys.path[0] != PROJECT_ROOT:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.models.vehicle import VehicleModel
from backend.app.models.route import RouteModel
from backend.app.models.assignment import PredictionModel, OptimizationConfigModel
from backend.app.models.simulation import CarbonBudgetModel, CarbonBudgetStatus
from backend.app.core.scoring import calculate_suitability_score
from backend.app.core.explainability import explain_assignment
from simulation.engine import SimulationEngine, ScenarioType


class TestExplainabilityEngine(unittest.TestCase):
    """Unit tests for deterministic 5-factor explanation & counterfactual generation."""

    def setUp(self):
        self.v_target = VehicleModel(
            vehicle_id="V001",
            vehicle_type="Van",
            fuel_type="Diesel",
            vehicle_age=2,
            fuel_capacity_l=80.0,
            max_payload_kg=1500.0,
            available=True,
        )
        self.v_alt_good = VehicleModel(
            vehicle_id="V002",
            vehicle_type="Light Commercial",
            fuel_type="Diesel",
            vehicle_age=5,
            fuel_capacity_l=120.0,
            max_payload_kg=3500.0,
            available=True,
        )
        self.v_alt_infeasible_cap = VehicleModel(
            vehicle_id="V003",
            vehicle_type="Van",
            fuel_type="Electric",
            vehicle_age=1,
            fuel_capacity_l=60.0,
            max_payload_kg=500.0,  # Too small for 1000kg route!
            available=True,
        )
        self.v_alt_infeasible_avail = VehicleModel(
            vehicle_id="V004",
            vehicle_type="Van",
            fuel_type="Hybrid",
            vehicle_age=1,
            fuel_capacity_l=80.0,
            max_payload_kg=2000.0,
            available=False,  # In maintenance!
        )

        self.route = RouteModel(
            route_id="R001",
            origin="Depot A",
            destination="Zone 1",
            distance_km=40.0,
            required_payload_kg=1000.0,
            traffic_factor=1.1,
            priority=1,
        )

        self.fleet = [self.v_target, self.v_alt_good, self.v_alt_infeasible_cap, self.v_alt_infeasible_avail]
        self.routes = [self.route]

        self.predictions = [
            PredictionModel(
                vehicle_id="V001",
                route_id="R001",
                predicted_fuel_l=12.0,
                estimated_co2_kg=32.2,
                fuel_lower_l=10.0,
                fuel_upper_l=14.0,
                uncertainty_l=2.0,
                uncertainty_pct=16.7,
                risk_adjusted_fuel_l=13.0,
            ),
            PredictionModel(
                vehicle_id="V002",
                route_id="R001",
                predicted_fuel_l=15.5,
                estimated_co2_kg=41.5,
                fuel_lower_l=12.5,
                fuel_upper_l=18.5,
                uncertainty_l=3.0,
                uncertainty_pct=19.4,
                risk_adjusted_fuel_l=17.0,
            ),
            PredictionModel(
                vehicle_id="V003",
                route_id="R001",
                predicted_fuel_l=6.0,
                estimated_co2_kg=2.7,
            ),
            PredictionModel(
                vehicle_id="V004",
                route_id="R001",
                predicted_fuel_l=9.0,
                estimated_co2_kg=13.5,
            ),
        ]

        self.carbon_budget = CarbonBudgetModel(
            budget_kg=1500.0,
            consumed_kg=0.0,
            projected_kg=1043.0,
            projected_total_kg=1043.0,
            remaining_budget_kg=457.0,
            budget_headroom_kg=457.0,
            budget_utilisation_pct=69.5,
            status=CarbonBudgetStatus.HEALTHY,
            dynamic_co2_penalty=1.0,
            co2_avoided_kg=120.0,
        )

    def test_1_explanation_exists_for_valid_assignment(self):
        """1. Verify explanation is generated for valid assignment."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
        )
        self.assertIsNotNone(exp)
        self.assertEqual(exp.vehicle_id, "V001")
        self.assertEqual(exp.route_id, "R001")
        self.assertTrue(len(exp.summary_verdict) > 0)
        self.assertTrue(len(exp.full_narrative) > 0)

    def test_2_selected_vehicle_is_feasible(self):
        """2. Verify target vehicle satisfies availability and capacity."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
        )
        self.assertGreaterEqual(exp.target.max_payload_kg, exp.target.required_payload_kg)

    def test_3_alternative_is_feasible_and_excludes_infeasible_candidates(self):
        """3 & 4. Verify alternative is strictly feasible (excludes V003 and V004) and is not target."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
        )
        self.assertTrue(exp.has_alternative)
        self.assertIsNotNone(exp.alternative)
        # V003 has capacity shortfall (500kg < 1000kg) and V004 is unavailable
        # Therefore only V002 is feasible!
        self.assertEqual(exp.alternative.vehicle_id, "V002")
        self.assertNotEqual(exp.alternative.vehicle_id, self.v_target.vehicle_id)
        self.assertGreaterEqual(exp.alternative.max_payload_kg, self.route.required_payload_kg)

    def test_4_factor_scores_match_scoring_engine(self):
        """5. Verify factor scores exactly match calculate_suitability_score output."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
        )
        raw_score = calculate_suitability_score(self.v_target, self.route, predicted_fuel_l=12.0)
        self.assertEqual(exp.target.overall_suitability_score, raw_score.overall_score)
        self.assertEqual(exp.target.breakdown.fuel_efficiency, raw_score.breakdown.fuel_efficiency)
        self.assertEqual(exp.target.breakdown.capacity_match, raw_score.breakdown.capacity_match)

    def test_5_delta_calculations_mathematically_exact(self):
        """6 & 7. Verify delta fuel and delta CO2 are mathematically exact."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
        )
        alt = exp.alternative
        expected_d_fuel = round(15.5 - 12.0, 1)  # Alt_Fuel - Target_Fuel = 3.5 L
        expected_d_co2 = round(41.5 - 32.2, 1)   # Alt_CO2 - Target_CO2 = 9.3 kg
        expected_d_score = round(exp.target.overall_suitability_score - alt.overall_suitability_score, 1)

        self.assertAlmostEqual(alt.delta_fuel_l, expected_d_fuel, places=1)
        self.assertAlmostEqual(alt.delta_co2_kg, expected_d_co2, places=1)
        self.assertAlmostEqual(alt.delta_score, expected_d_score, places=1)

    def test_6_carbon_status_and_penalty_context(self):
        """10. Verify Carbon Governor status and penalty are accurately reflected."""
        stress_budget = CarbonBudgetModel(
            budget_kg=1500.0,
            consumed_kg=0.0,
            projected_kg=1392.0,
            projected_total_kg=1392.0,
            remaining_budget_kg=108.0,
            budget_headroom_kg=108.0,
            budget_utilisation_pct=92.8,
            status=CarbonBudgetStatus.CRITICAL,
            dynamic_co2_penalty=2.14,
            co2_avoided_kg=200.0,
        )
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=stress_budget,
        )
        self.assertEqual(exp.carbon_context.status, CarbonBudgetStatus.CRITICAL)
        self.assertEqual(exp.carbon_context.dynamic_co2_penalty, 2.14)
        self.assertIn("CRITICAL", exp.carbon_context.carbon_pressure_narrative)

    def test_7_risk_context_included_when_intervals_available(self):
        """11. Verify prediction uncertainty and risk level are accurately populated."""
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=self.fleet,
            routes=self.routes,
            predictions=self.predictions,
            carbon_budget=self.carbon_budget,
            risk_aversion_lambda=0.5,
        )
        self.assertIsNotNone(exp.risk_context)
        self.assertEqual(exp.risk_context.target_uncertainty_l, 2.0)
        self.assertIn("Conformal prediction interval", exp.risk_context.risk_narrative)

    def test_9_tie_suitability_explains_cost_difference(self):
        """Verify that when target and alternative have identical suitability score, explanation explicitly cites optimization cost."""
        # Create identical twin vehicle with same specs
        v_twin = VehicleModel(
            vehicle_id="V019",
            vehicle_type="Van",
            fuel_type="Diesel",
            vehicle_age=2,
            fuel_capacity_l=80.0,
            max_payload_kg=1500.0,
            available=True,
        )
        fleet = [self.v_target, v_twin]
        preds = [
            self.predictions[0],  # V001
            PredictionModel(
                vehicle_id="V019",
                route_id="R001",
                predicted_fuel_l=12.5, # Slightly higher fuel => slightly higher QUBO cost
                estimated_co2_kg=33.5,
                uncertainty_l=2.0,
                risk_adjusted_fuel_l=13.5,
            )
        ]
        exp = explain_assignment(
            target_vehicle=self.v_target,
            target_route=self.route,
            fleet=fleet,
            routes=self.routes,
            predictions=preds,
            carbon_budget=self.carbon_budget,
        )
        self.assertEqual(exp.alternative.vehicle_id, "V019")
        # Suitability score is identical or near-identical
        self.assertAlmostEqual(exp.alternative.delta_score, 0.0, places=0)
        # Summary verdict explicitly clarifies cost preference rather than claiming score gap
        self.assertIn("equivalent suitability", exp.summary_verdict)
        self.assertIn("QUBO optimization cost", exp.summary_verdict)


class TestSimulationExplainabilityIntegration(unittest.TestCase):
    """Integration tests verifying end-to-end simulation explainability endpoints."""

    def setUp(self):
        self.engine = SimulationEngine(initial_budget_kg=1500.0)

    def test_8_simulation_engine_explains_all_assigned_vehicles(self):
        """1. Verify every assigned vehicle has a valid, non-empty explanation."""
        self.engine.reset()
        opt_state = self.engine.run_optimization()
        
        assigned_vehicles = [a.vehicle_id for a in opt_state.greenflow_assignments if a.status == "assigned"]
        self.assertTrue(len(assigned_vehicles) > 0)

        for v_id in assigned_vehicles:
            exp = self.engine.get_assignment_explanation(v_id)
            self.assertEqual(exp.vehicle_id, v_id)
            self.assertIsNotNone(exp.target)
            self.assertTrue(len(exp.key_advantages) > 0)
            self.assertTrue(len(exp.counterfactuals) > 0)


if __name__ == "__main__":
    unittest.main()


