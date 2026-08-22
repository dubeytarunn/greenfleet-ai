"""
Unit and integration tests for GreenFlow AI Commercial Economics & Decision Support Engine.
"""

import unittest
from backend.app.core.economics import (
    calculate_fleet_fuel_cost,
    calculate_carbon_shadow_cost,
    calculate_economic_savings_breakdown,
    generate_actionable_recommendation,
    run_what_if_simulation,
    compile_scenario_matrix,
    DEFAULT_FUEL_PRICING,
    DEFAULT_CARBON_PRICING,
)
from backend.app.models.assignment import AssignmentModel
from backend.app.models.economics import (
    CarbonPricingConfig,
    FuelPricingConfig,
    WhatIfRequest,
)
from backend.app.models.simulation import CarbonBudgetStatus, ScenarioType
from backend.app.models.vehicle import VehicleModel
from backend.app.models.route import RouteModel
from simulation.engine import SimulationEngine


class TestCommercialEconomics(unittest.TestCase):
    """Unit tests for pricing calculations, shadow valuation, and differentiated reporting."""

    def setUp(self):
        self.fuel_pricing = FuelPricingConfig(
            diesel_price_per_l=94.0,
            petrol_price_per_l=102.0,
            cng_price_per_kg=85.0,
            electric_price_per_kwh=8.5,
        )
        self.carbon_pricing = CarbonPricingConfig(
            internal_shadow_price_per_tonne=2500.0  # ₹2.50 per kg
        )

        self.vehicles = [
            VehicleModel(vehicle_id="V001", vehicle_type="Van", fuel_type="Diesel", vehicle_age=2, fuel_capacity_l=80.0, max_payload_kg=1500, available=True),
            VehicleModel(vehicle_id="V002", vehicle_type="Truck", fuel_type="Petrol", vehicle_age=3, fuel_capacity_l=150.0, max_payload_kg=3500, available=True),
            VehicleModel(vehicle_id="V003", vehicle_type="Van", fuel_type="CNG", vehicle_age=1, fuel_capacity_l=60.0, max_payload_kg=1200, available=True),
        ]


        self.assignments = [
            AssignmentModel(vehicle_id="V001", route_id="R001", status="assigned", predicted_fuel_l=10.0, estimated_co2_kg=26.8),
            AssignmentModel(vehicle_id="V002", route_id="R002", status="assigned", predicted_fuel_l=20.0, estimated_co2_kg=46.2),
            AssignmentModel(vehicle_id="V003", route_id="R003", status="assigned", predicted_fuel_l=5.0, estimated_co2_kg=9.8),
        ]

    def test_1_fuel_pricing_by_vehicle_type(self):
        """1. Verify fuel pricing calculation applies correct rate per fuel type."""
        # V001 (Diesel): 10.0 L * 94.0 = 940.0
        # V002 (Petrol): 20.0 L * 102.0 = 2040.0
        # V003 (CNG): 5.0 kg * 85.0 = 425.0
        # Total = 3405.0
        total = calculate_fleet_fuel_cost(self.assignments, self.vehicles, self.fuel_pricing)
        self.assertEqual(total, 3405.0)

    def test_2_carbon_shadow_valuation(self):
        """2. Verify carbon shadow cost calculation (₹2,500/tonne = ₹2.50/kg)."""
        shadow = calculate_carbon_shadow_cost(co2_kg=100.0, pricing=self.carbon_pricing)
        self.assertEqual(shadow, 250.0)

    def test_3_differentiated_economic_breakdown(self):
        """3. Verify differentiated reporting separates direct fuel cash savings from carbon shadow valuation."""
        opt_assignments = [
            AssignmentModel(vehicle_id="V001", route_id="R001", status="assigned", predicted_fuel_l=8.0, estimated_co2_kg=21.4), # -2L Diesel (-₹188)
            AssignmentModel(vehicle_id="V002", route_id="R002", status="assigned", predicted_fuel_l=18.0, estimated_co2_kg=41.5), # -2L Petrol (-₹204)
            AssignmentModel(vehicle_id="V003", route_id="R003", status="assigned", predicted_fuel_l=5.0, estimated_co2_kg=9.8),
        ]
        breakdown = calculate_economic_savings_breakdown(
            baseline_assignments=self.assignments,
            greenflow_assignments=opt_assignments,
            vehicles=self.vehicles,
            fuel_pricing=self.fuel_pricing,
            carbon_pricing=self.carbon_pricing,
        )
        # Direct Fuel Savings = (10*94 + 20*102 + 5*85) - (8*94 + 18*102 + 5*85) = 3405 - 3013 = 392.0
        self.assertEqual(breakdown.direct_fuel_cost_saved, 392.0)
        # CO2 Avoided = (26.8 + 46.2 + 9.8) - (21.4 + 41.5 + 9.8) = 82.8 - 72.7 = 10.1 kg
        self.assertEqual(breakdown.co2_avoided_kg, 10.1)
        # Shadow Value = 10.1 * 2.50 = 25.25
        self.assertEqual(breakdown.avoided_carbon_shadow_value, 25.25)
        # Combined Impact = 392.0 + 25.25 = 417.25
        self.assertEqual(breakdown.combined_economic_impact, 417.25)
        self.assertIn("Simulated", breakdown.disclaimer)

    def test_4_actionable_recommendation_peak_demand(self):
        """4. Verify rule-based dispatcher recommendation synthesizes correctly under peak demand."""
        rec = generate_actionable_recommendation(
            scenario=ScenarioType.PEAK_DEMAND,
            carbon_status=CarbonBudgetStatus.WARNING,
            quota_utilisation_pct=82.9,
            co2_avoided_kg=21.6,
            fuel_saved_l=2.5,
            direct_cost_saved=235.0,
            shadow_value=54.0,
            reassigned_count=10,
            is_optimized=False,
        )
        self.assertEqual(rec.urgency_level, "CAUTION")
        self.assertIn("PEAK DEMAND", rec.status_badge)
        self.assertIn("82.9%", rec.problem_diagnosis)
        self.assertIn("Prioritize lower-emission", rec.recommended_action)
        self.assertEqual(rec.expected_impact["co2_avoided"], "21.6 kg CO2e")


class TestSimulationDecisionSupportIntegration(unittest.TestCase):
    """Integration tests for SimulationEngine what-if planning, recommendations, and scenario matrix."""

    def setUp(self):
        self.engine = SimulationEngine(initial_budget_kg=1500.0)

    def test_5_what_if_does_not_mutate_simulation_state(self):
        """5. CRITICAL: Verify what-if simulation calculates projections on a copy without mutating current state."""
        self.engine.reset()
        initial_state = self.engine.get_state()
        initial_scenario = initial_state.scenario
        initial_updated = initial_state.timestamp

        # Run What-If with extreme stress (2.0x traffic, 1000kg budget)
        what_if_req = WhatIfRequest(
            carbon_budget_kg=1000.0,
            traffic_factor_multiplier=2.0,
            risk_aversion_lambda=1.2,
            diesel_price_per_l=105.0,
        )
        projection = self.engine.simulate_what_if(what_if_req)

        self.assertIsNotNone(projection)
        self.assertGreater(projection.projected_fuel_l, 0)
        self.assertGreater(projection.projected_co2_kg, 0)

        # Confirm primary simulation state is 100% untouched
        post_state = self.engine.get_state()
        self.assertEqual(post_state.scenario, initial_scenario)
        self.assertEqual(post_state.carbon_budget.budget_kg, 1500.0)
        self.assertEqual(post_state.timestamp, initial_updated)

    def test_6_scenario_matrix_contains_all_scenarios(self):
        """6. Verify 4-way scenario matrix compiles with all standard operating conditions."""
        matrix = self.engine.get_scenario_matrix()
        self.assertEqual(len(matrix.scenarios), 4)
        keys = [s.scenario_key for s in matrix.scenarios]
        self.assertIn("normal", keys)
        self.assertIn("peak_demand", keys)
        self.assertIn("high_traffic", keys)
        self.assertIn("carbon_constrained", keys)

        # Verify all records have valid fuel, CO2, and INR cost values
        for s in matrix.scenarios:
            self.assertGreater(s.total_fuel_l, 0)
            self.assertGreater(s.total_co2_kg, 0)
            self.assertGreater(s.direct_fuel_cost, 0)
            self.assertGreater(s.quota_utilisation_pct, 0)


if __name__ == "__main__":
    unittest.main()
