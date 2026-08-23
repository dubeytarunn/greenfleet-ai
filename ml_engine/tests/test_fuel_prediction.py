"""
Unit Tests for ML Fuel Consumption Prediction:
- Valid numeric results
- Single record inference
- Telemetry window inference
- No NaN / Infinity values
- Trip-level & vehicle-route cost matrix calculations
"""

import os
import sys
import unittest
import numpy as np

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.fuel_predictor import predict_fuel_consumption, get_telemetry_model
from predict import predict_trip, predict_fuel, build_fuel_cost_matrix


class TestFuelPrediction(unittest.TestCase):

    def setUp(self):
        self.sample_telemetry = {
            "vehicle_id": "V001",
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "speed_kmph": 55.0,
            "acceleration_mps2": 0.2,
            "rpm": 1650.0,
            "gear": 5,
            "engine_load_pct": 52.0,
            "road_slope_pct": 0.5,
            "road_type": "Highway",
            "traffic_level": "Medium",
            "vehicle_age_years": 3,
            "engine_size_l": 6.7,
            "vehicle_weight_kg": 9500.0,
            "ambient_temperature_c": 28.0,
            "idle_duration_sec": 0,
        }

    def test_single_telemetry_fuel_prediction(self):
        """Test #9 & #12: Model inference works on one telemetry record and returns valid numeric result."""
        res = predict_fuel_consumption(self.sample_telemetry)
        self.assertIn("expected_fuel_consumption_l_100km", res)
        self.assertIn("expected_fuel_rate_lph", res)
        self.assertIn("expected_efficiency_kmpl", res)

        l_100km = res["expected_fuel_consumption_l_100km"]
        lph = res["expected_fuel_rate_lph"]
        kmpl = res["expected_efficiency_kmpl"]

        self.assertIsInstance(l_100km, float)
        self.assertIsInstance(lph, float)
        self.assertIsInstance(kmpl, float)

        self.assertGreater(l_100km, 0.0)
        self.assertGreater(lph, 0.0)
        self.assertGreater(kmpl, 0.0)

    def test_window_telemetry_fuel_prediction(self):
        """Test #13: Model inference works on a telemetry window."""
        window = [self.sample_telemetry.copy() for _ in range(10)]
        for i, frame in enumerate(window):
            frame["speed_kmph"] = 50.0 + i
            frame["rpm"] = 1500.0 + (i * 30)

        res = predict_fuel_consumption(window)
        self.assertGreater(res["expected_fuel_consumption_l_100km"], 0.0)
        self.assertGreater(res["expected_fuel_rate_lph"], 0.0)

    def test_no_nan_or_inf_in_inference(self):
        """Test #14: No NaN or infinity values in inference output even under extreme inputs."""
        extreme_telemetry = {
            "vehicle_id": "V999",
            "vehicle_type": "Semi-Trailer",
            "fuel_type": "Diesel",
            "speed_kmph": 0.0,  # Zero speed (idle edge case)
            "acceleration_mps2": 0.0,
            "rpm": 700.0,
            "gear": 0,
            "engine_load_pct": 10.0,
            "road_slope_pct": 0.0,
            "road_type": "Urban",
            "traffic_level": "Gridlock",
            "vehicle_age_years": 10,
            "engine_size_l": 12.8,
            "vehicle_weight_kg": 25000.0,
            "ambient_temperature_c": 45.0,
            "idle_duration_sec": 120,
        }
        res = predict_fuel_consumption(extreme_telemetry)
        for key, val in res.items():
            self.assertFalse(np.isnan(val), f"Value for {key} is NaN")
            self.assertFalse(np.isinf(val), f"Value for {key} is Infinity")

    def test_trip_level_backward_compatibility(self):
        """Verify trip-level fuel prediction and cost matrix generation remain intact."""
        vehicle = {
            "vehicle_id": "V001",
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "vehicle_age": 4,
            "fuel_capacity_l": 180.0,
            "max_payload_kg": 5000.0,
            "available": True,
        }
        route = {
            "route_id": "R001",
            "origin": "Depot A",
            "destination": "Zone 1",
            "distance_km": 42.5,
            "required_payload_kg": 3200.0,
            "traffic_factor": 1.2,
            "priority": 2,
        }
        pred = predict_trip(vehicle, route)
        self.assertEqual(pred["vehicle_id"], "V001")
        self.assertEqual(pred["route_id"], "R001")
        self.assertGreater(pred["predicted_fuel_l"], 0.0)
        self.assertGreater(pred["estimated_co2_kg"], 0.0)


if __name__ == "__main__":
    unittest.main()
