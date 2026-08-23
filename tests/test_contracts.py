"""
GreenFleet AI - Contract & Architecture Test Suite
=================================================
Automated verification ensuring all components adhere to the strict shared schemas:
- Vehicle
- Route
- Prediction
- Assignment
And all API route handlers return valid schemas and adhere to contracts.
"""

import os
import sys
import unittest

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from backend.app.main import app, health, root
from backend.app.models.schemas import (
    Vehicle,
    Route,
    Prediction,
    Assignment,
    VehiclePair,
    BatchPredictionRequest,
    OptimizeRequest,
    SimulationRunRequest,
)
from backend.app.api.fleet import get_vehicles, get_routes, add_vehicle, add_route
from backend.app.api.prediction import batch_predict
from backend.app.api.optimization import compute_assignments
from backend.app.api.simulation import run_simulation, get_benchmark_summary


class TestGreenFleetContracts(unittest.TestCase):

    def test_vehicle_contract(self):
        """Verify Vehicle schema matches the exact required specification."""
        raw_vehicle = {
            "vehicle_id": "V001",
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "vehicle_age": 4,
            "fuel_capacity_l": 180.0,
            "max_payload_kg": 5000.0,
            "available": True,
        }
        v = Vehicle(**raw_vehicle)
        self.assertEqual(v.vehicle_id, "V001")
        self.assertEqual(v.vehicle_type, "Truck")
        self.assertEqual(v.fuel_type, "Diesel")
        self.assertEqual(v.vehicle_age, 4)
        self.assertEqual(v.fuel_capacity_l, 180.0)
        self.assertEqual(v.max_payload_kg, 5000.0)
        self.assertTrue(v.available)
        self.assertEqual(v.model_dump(), raw_vehicle)

    def test_route_contract(self):
        """Verify Route schema matches the exact required specification."""
        raw_route = {
            "route_id": "R001",
            "origin": "Depot A",
            "destination": "Zone 1",
            "distance_km": 42.5,
            "required_payload_kg": 3200.0,
            "traffic_factor": 1.2,
            "priority": 2,
        }
        r = Route(**raw_route)
        self.assertEqual(r.route_id, "R001")
        self.assertEqual(r.origin, "Depot A")
        self.assertEqual(r.destination, "Zone 1")
        self.assertEqual(r.distance_km, 42.5)
        self.assertEqual(r.required_payload_kg, 3200.0)
        self.assertEqual(r.traffic_factor, 1.2)
        self.assertEqual(r.priority, 2)
        self.assertEqual(r.model_dump(), raw_route)

    def test_prediction_contract(self):
        """Verify Prediction schema matches the exact required specification."""
        raw_prediction = {
            "vehicle_id": "V001",
            "route_id": "R001",
            "predicted_fuel_l": 18.4,
            "estimated_co2_kg": 48.8,
        }
        p = Prediction(**raw_prediction)
        self.assertEqual(p.vehicle_id, "V001")
        self.assertEqual(p.route_id, "R001")
        self.assertEqual(p.predicted_fuel_l, 18.4)
        self.assertEqual(p.estimated_co2_kg, 48.8)
        self.assertEqual(p.model_dump(exclude_unset=True), raw_prediction)

    def test_assignment_contract(self):
        """Verify Assignment schema matches the exact required specification."""
        raw_assignment = {
            "vehicle_id": "V001",
            "route_id": "R001",
            "predicted_fuel_l": 18.4,
            "status": "assigned",
        }
        a = Assignment(**raw_assignment)
        self.assertEqual(a.vehicle_id, "V001")
        self.assertEqual(a.route_id, "R001")
        self.assertEqual(a.predicted_fuel_l, 18.4)
        self.assertEqual(a.status, "assigned")
        self.assertEqual(a.model_dump(exclude_unset=True), raw_assignment)


    def test_api_health_and_root(self):
        h = health()
        self.assertEqual(h["status"], "healthy")
        r = root()
        self.assertEqual(r["name"], "GreenFleet AI")
        self.assertIn("contracts", r)

    def test_api_fleet_vehicles(self):
        vehicles = get_vehicles()
        self.assertIsInstance(vehicles, list)
        self.assertGreater(len(vehicles), 0)
        for v in vehicles:
            self.assertIsInstance(v, Vehicle)

    def test_api_fleet_routes(self):
        routes = get_routes()
        self.assertIsInstance(routes, list)
        self.assertGreater(len(routes), 0)
        for r in routes:
            self.assertIsInstance(r, Route)

    def test_api_prediction_batch(self):
        v = Vehicle(
            vehicle_id="V001",
            vehicle_type="Truck",
            fuel_type="Diesel",
            vehicle_age=4,
            fuel_capacity_l=180.0,
            max_payload_kg=5000.0,
            available=True,
        )
        r = Route(
            route_id="R001",
            origin="Depot A",
            destination="Zone 1",
            distance_km=42.5,
            required_payload_kg=3200.0,
            traffic_factor=1.2,
            priority=2,
        )
        req = BatchPredictionRequest(pairs=[VehiclePair(vehicle=v, route=r)])
        res = batch_predict(req)
        self.assertEqual(res.total_evaluated, 1)
        self.assertEqual(len(res.predictions), 1)
        p = res.predictions[0]
        self.assertIsInstance(p, Prediction)
        self.assertEqual(p.vehicle_id, "V001")
        self.assertEqual(p.route_id, "R001")
        self.assertGreater(p.predicted_fuel_l, 0)
        self.assertGreater(p.estimated_co2_kg, 0)

    def test_api_optimization_assign(self):
        vehicles = get_vehicles()
        routes = get_routes()
        req = OptimizeRequest(vehicles=vehicles, routes=routes, objective="balanced")
        res = compute_assignments(req)
        self.assertGreater(len(res.assignments), 0)
        for item in res.assignments:
            self.assertIsInstance(item, Assignment)
            self.assertEqual(item.status, "assigned")
        self.assertGreater(res.total_fuel_l, 0)
        self.assertGreater(res.total_co2_kg, 0)

    def test_api_simulation_run(self):
        req = SimulationRunRequest(scenario="peak_surge", traffic_multiplier=1.2, payload_multiplier=1.1)
        res = run_simulation(req)
        self.assertEqual(res.scenario, "peak_surge")
        self.assertGreater(res.baseline.total_co2_kg, res.optimized.total_co2_kg)
        self.assertGreater(res.baseline.total_fuel_l, res.optimized.total_fuel_l)
        self.assertGreater(res.deltas["co2_reduction_pct"], 0)
        self.assertGreater(res.deltas["fuel_saved_l"], 0)

    def test_pipeline_flow(self):
        """
        Verify complete pipeline flow:
        ML output -> Optimizer input -> Optimizer output -> Simulation input -> Simulation output
        """
        # 1. Inputs
        vehicles = get_vehicles()
        routes = get_routes()

        # 2. ML Output
        pairs = [VehiclePair(vehicle=v, route=r) for v in vehicles for r in routes]
        pred_res = batch_predict(BatchPredictionRequest(pairs=pairs))
        predictions = pred_res.predictions
        self.assertEqual(len(predictions), len(vehicles) * len(routes))

        # 3. Optimizer Input -> Optimizer Output
        opt_req = OptimizeRequest(vehicles=vehicles, routes=routes, predictions=predictions)
        opt_res = compute_assignments(opt_req)
        assignments = opt_res.assignments
        self.assertGreater(len(assignments), 0)

        # 4. Simulation Input -> Simulation Output
        sim_req = SimulationRunRequest(scenario="normal", traffic_multiplier=1.0, payload_multiplier=1.0)
        sim_res = run_simulation(sim_req)
        self.assertIn("deltas", sim_res.model_dump())
        self.assertGreater(sim_res.deltas["co2_reduction_pct"], 0)


if __name__ == "__main__":
    unittest.main()
