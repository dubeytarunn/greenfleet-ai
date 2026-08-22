"""
GreenFlow AI - Risk-Aware Fuel Prediction & Conformal Uncertainty Test Suite
===========================================================================
Validates:
1. Point prediction preservation.
2. Lower bound <= expected prediction <= upper bound.
3. Non-negative uncertainty (U >= 0).
4. Risk-adjusted fuel >= expected fuel for lambda > 0.
5. lambda = 0 produces expected fuel.
6. Monotonic increase of risk-adjusted fuel with lambda.
7. Optimizer cost matrix integrates risk-adjusted fuel.
8. Carbon Budget Governor still scales dynamic CO2 weight independently.
9. Feasibility of assignments under risk aversion.
10. Simulation lifecycle and state transitions with uncertainty metrics.
11. Dynamic benchmark execution and reporting.
12. Controlled Trade-off Test:
    - Vehicle A: Lower expected fuel (18 L), Higher uncertainty (+8 L -> F_risk=26 L).
    - Vehicle B: Higher expected fuel (20 L), Lower uncertainty (+1 L -> F_risk=21 L).
    - Proves lambda=0 selects Vehicle A, while risk-averse lambda=1.0 flips preference to Vehicle B!
"""

import unittest
import os
import sys
import numpy as np

# Ensure project root is at sys.path[0]
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if sys.path[0] != PROJECT_ROOT:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.models.vehicle import VehicleModel
from backend.app.models.route import RouteModel
from backend.app.models.assignment import OptimizationConfigModel
from backend.app.core.integration import predict_fuel_and_co2, run_greenflow_optimizer
from backend.app.core.quantum_optimizer import (
    QuantumInspiredOptimizer,
    Vehicle as OptVehicle,
    Route as OptRoute,
    Prediction as OptPrediction,
    OptimizationConfig as CoreOptConfig,
)
from ml_engine.predict import (
    predict_fuel,
    predict_fuel_with_uncertainty,
    predict_trip,
    calculate_dispersion_factor,
)
from simulation.engine import SimulationEngine, ScenarioType


class TestRiskAwarePrediction(unittest.TestCase):
    """Unit tests for ML-level conformal uncertainty and risk-adjusted fuel formulas."""

    def setUp(self):
        self.sample_vehicle = {
            "vehicle_id": "V001",
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "vehicle_age": 4,
            "fuel_capacity_l": 180.0,
            "max_payload_kg": 5000.0,
            "available": True,
        }
        self.sample_route = {
            "route_id": "R001",
            "origin": "Central Depot",
            "destination": "North Zone",
            "distance_km": 60.0,
            "required_payload_kg": 3500.0,
            "traffic_factor": 1.2,
            "priority": 2,
            "road_grade": 0.02,
            "weather_factor": 1.1,
        }

    def test_1_point_prediction_unchanged(self):
        """1. Verify standard point prediction remains accurate and unaltered."""
        base_pred = predict_fuel(self.sample_vehicle, self.sample_route)
        unc_pred = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=0.0)
        self.assertEqual(base_pred, unc_pred["predicted_fuel_l"])

    def test_2_lower_bound_le_prediction_le_upper_bound(self):
        """2. Verify conformal bounds satisfy F_low <= F_hat <= F_high."""
        res = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route)
        self.assertLessEqual(res["fuel_lower_l"], res["predicted_fuel_l"])
        self.assertLessEqual(res["predicted_fuel_l"], res["fuel_upper_l"])

    def test_3_uncertainty_is_non_negative(self):
        """3. Verify prediction uncertainty half-width U >= 0."""
        res = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route)
        self.assertGreaterEqual(res["uncertainty_l"], 0.0)
        self.assertGreaterEqual(res["uncertainty_pct"], 0.0)

    def test_4_risk_adjusted_fuel_ge_expected_when_lambda_positive(self):
        """4. Verify F_risk >= F_hat when lambda > 0."""
        res = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=0.7)
        self.assertGreater(res["risk_adjusted_fuel_l"], res["predicted_fuel_l"])

    def test_5_lambda_zero_produces_expected_fuel(self):
        """5. Verify lambda = 0 exactly equals expected point prediction."""
        res = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=0.0)
        self.assertEqual(res["risk_adjusted_fuel_l"], res["predicted_fuel_l"])

    def test_6_monotonic_increase_with_lambda(self):
        """6. Verify increasing lambda monotonically increases risk-adjusted fuel."""
        r0 = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=0.0)
        r1 = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=0.5)
        r2 = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=1.0)
        r3 = predict_fuel_with_uncertainty(self.sample_vehicle, self.sample_route, risk_aversion_lambda=2.0)
        
        self.assertLess(r0["risk_adjusted_fuel_l"], r1["risk_adjusted_fuel_l"])
        self.assertLess(r1["risk_adjusted_fuel_l"], r2["risk_adjusted_fuel_l"])
        self.assertLess(r2["risk_adjusted_fuel_l"], r3["risk_adjusted_fuel_l"])

    def test_7_dispersion_scales_with_traffic_and_payload_stress(self):
        """Verify heteroscedastic dispersion factor increases with traffic and payload stress."""
        route_calm = {**self.sample_route, "traffic_factor": 1.0, "required_payload_kg": 1000.0}
        route_stress = {**self.sample_route, "traffic_factor": 1.6, "required_payload_kg": 4800.0}
        
        disp_calm = calculate_dispersion_factor(self.sample_vehicle, route_calm)
        disp_stress = calculate_dispersion_factor(self.sample_vehicle, route_stress)
        self.assertGreater(disp_stress, disp_calm)


class TestOptimizerRiskIntegration(unittest.TestCase):
    """Integration tests verifying risk-adjusted fuel entering the QUBO / SA cost matrix."""

    def test_8_optimizer_receives_risk_adjusted_fuel(self):
        """7. Verify optimizer receives and acts upon risk-adjusted fuel in cost matrix."""
        v = OptVehicle("V1", "Truck", "Diesel", 3, 150.0, 5000.0, True)
        r = OptRoute("R1", "A", "B", 50.0, 3000.0, 1.0, 1)
        
        pred = OptPrediction(
            vehicle_id="V1",
            route_id="R1",
            predicted_fuel_l=20.0,
            estimated_co2_kg=53.6,
            fuel_lower_l=17.0,
            fuel_upper_l=23.0,
            uncertainty_l=3.0,
            risk_adjusted_fuel_l=21.5,
        )
        
        config_neutral = CoreOptConfig(fuel_weight=1.0, co2_weight=0.0, distance_weight=0.0, risk_aversion_lambda=0.0)
        opt_neutral = QuantumInspiredOptimizer([v], [r], [pred], config=config_neutral)
        
        # When risk_adjusted_fuel_l is explicitly set, cost uses it
        cost_neutral = opt_neutral._build_cost_matrix()[0, 0]
        self.assertAlmostEqual(cost_neutral, 21.5 + (0.05 * 2000.0), places=1)

    def test_9_carbon_governor_operates_independently(self):
        """8. Verify Carbon Governor dynamic CO2 weight scales independently of risk aversion."""
        v = OptVehicle("V1", "Truck", "Diesel", 3, 150.0, 5000.0, True)
        r = OptRoute("R1", "A", "B", 50.0, 3000.0, 1.0, 1)
        
        pred = OptPrediction(
            vehicle_id="V1",
            route_id="R1",
            predicted_fuel_l=20.0,
            estimated_co2_kg=50.0,
            fuel_lower_l=16.0,
            fuel_upper_l=24.0,
            uncertainty_l=4.0,
        )
        
        config_low_co2 = CoreOptConfig(fuel_weight=1.0, co2_weight=1.0, distance_weight=0.0, risk_aversion_lambda=0.5)
        config_high_co2 = CoreOptConfig(fuel_weight=1.0, co2_weight=3.0, distance_weight=0.0, risk_aversion_lambda=0.5)
        
        opt_low = QuantumInspiredOptimizer([v], [r], [pred], config=config_low_co2)
        opt_high = QuantumInspiredOptimizer([v], [r], [pred], config=config_high_co2)
        
        cost_low = opt_low._build_cost_matrix()[0, 0]
        cost_high = opt_high._build_cost_matrix()[0, 0]
        
        # Differential must be exactly (3.0 - 1.0) * 50.0 = 100.0 CO2 penalty delta
        self.assertAlmostEqual(cost_high - cost_low, 100.0, places=1)

    def test_10_controlled_risk_trade_off_decision_flip(self):
        """
        12. CRITICAL CONTROLLED TRADE-OFF TEST:
        Vehicle A: Lower Expected Fuel (18 L), High Uncertainty (U = 8 L, Upper = 26 L)
                   -> F_risk(lambda=0.0) = 18.0 L
                   -> F_risk(lambda=1.0) = 26.0 L
        Vehicle B: Slightly Higher Expected Fuel (20 L), Low Uncertainty (U = 1 L, Upper = 21 L)
                   -> F_risk(lambda=0.0) = 20.0 L
                   -> F_risk(lambda=1.0) = 21.0 L

        Under lambda = 0.0 (Risk-Neutral): Optimizer MUST choose Vehicle A (18.0 L < 20.0 L).
        Under lambda = 1.0 (Risk-Averse):  Optimizer MUST choose Vehicle B (21.0 L < 26.0 L).
        """
        v_a = OptVehicle("VA", "Truck", "Diesel", 8, 200.0, 5000.0, True)
        v_b = OptVehicle("VB", "Truck", "Diesel", 1, 200.0, 5000.0, True)
        route = OptRoute("R1", "Hub", "Drop", 80.0, 4000.0, 1.2, 1)
        
        pred_a = OptPrediction(
            vehicle_id="VA",
            route_id="R1",
            predicted_fuel_l=18.0,
            estimated_co2_kg=48.0,
            fuel_lower_l=10.0,
            fuel_upper_l=26.0,
            uncertainty_l=8.0,
        )
        
        pred_b = OptPrediction(
            vehicle_id="VB",
            route_id="R1",
            predicted_fuel_l=20.0,
            estimated_co2_kg=48.0,
            fuel_lower_l=19.0,
            fuel_upper_l=21.0,
            uncertainty_l=1.0,
        )
        
        # Test Case 1: Risk Neutral (lambda = 0.0)
        config_risk_neutral = CoreOptConfig(
            fuel_weight=1.0,
            co2_weight=0.0,
            distance_weight=0.0,
            imbalance_weight=0.0,
            risk_aversion_lambda=0.0,
            seed=42,
        )
        opt_neutral = QuantumInspiredOptimizer([v_a, v_b], [route], [pred_a, pred_b], config=config_risk_neutral)
        res_neutral = opt_neutral.solve_simulated_annealing()
        assign_neutral = opt_neutral.to_assignment_list(res_neutral)
        self.assertEqual(assign_neutral[0]["vehicle_id"], "VA", "Risk-neutral optimizer must choose Vehicle A (lower expected fuel)")

        # Test Case 2: Risk Averse (lambda = 1.0)
        config_risk_averse = CoreOptConfig(
            fuel_weight=1.0,
            co2_weight=0.0,
            distance_weight=0.0,
            imbalance_weight=0.0,
            risk_aversion_lambda=1.0,
            seed=42,
        )
        opt_averse = QuantumInspiredOptimizer([v_a, v_b], [route], [pred_a, pred_b], config=config_risk_averse)
        res_averse = opt_averse.solve_simulated_annealing()
        assign_averse = opt_averse.to_assignment_list(res_averse)
        self.assertEqual(assign_averse[0]["vehicle_id"], "VB", "Risk-averse optimizer must flip preference to Vehicle B (lower uncertainty)")


class TestSimulationLifecycleUncertainty(unittest.TestCase):
    """Tests verifying simulation engine, benchmarks, and scenarios with uncertainty."""

    def setUp(self):
        self.engine = SimulationEngine(initial_budget_kg=1500.0)

    def test_11_simulation_reset_has_uncertainty_bounds(self):
        """9 & 10. Verify simulation state populates predictions with conformal bounds."""
        state = self.engine.reset()
        self.assertTrue(len(self.engine.predictions) > 0)
        p0 = self.engine.predictions[0]
        self.assertIsNotNone(p0.fuel_lower_l)
        self.assertIsNotNone(p0.fuel_upper_l)
        self.assertIsNotNone(p0.uncertainty_l)
        self.assertIsNotNone(p0.risk_adjusted_fuel_l)
        self.assertLessEqual(p0.fuel_lower_l, p0.predicted_fuel_l)
        self.assertLessEqual(p0.predicted_fuel_l, p0.fuel_upper_l)
        
        # Verify baseline assignments carry uncertainty metrics
        self.assertTrue(len(state.baseline_assignments) > 0)
        b0 = state.baseline_assignments[0]
        self.assertIsNotNone(b0.fuel_lower_l)
        self.assertIsNotNone(b0.fuel_upper_l)
        self.assertIsNotNone(b0.uncertainty_l)
        self.assertIsNotNone(b0.risk_adjusted_fuel_l)


    def test_12_simulation_optimization_and_benchmark(self):
        """11. Verify run_optimization computes valid benchmark with uncertainty metrics."""
        state = self.engine.run_optimization(config=OptimizationConfigModel(risk_aversion_lambda=0.5))
        self.assertEqual(state.status, "optimized (quantum_inspired)")
        self.assertIsNotNone(state.benchmark)
        self.assertTrue(len(state.greenflow_assignments) > 0)
        a0 = state.greenflow_assignments[0]
        self.assertIsNotNone(a0.fuel_lower_l)
        self.assertIsNotNone(a0.fuel_upper_l)
        self.assertIsNotNone(a0.uncertainty_l)
        self.assertIsNotNone(a0.risk_adjusted_fuel_l)


if __name__ == "__main__":
    unittest.main()
