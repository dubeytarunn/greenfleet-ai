"""
Unit Tests for Remaining Range & Refuel Urgency Predictor:
- Test 11: Remaining range is non-negative
- Refuel required flag when fuel level is low (<15%) or critically low (<10%)
- Route distance sufficiency check
"""

import os
import sys
import unittest

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.refuel_predictor import estimate_remaining_range


class TestRefuelPrediction(unittest.TestCase):

    def test_remaining_range_non_negative(self):
        """Test 11: Remaining range must always be non-negative (>= 0.0)."""
        res = estimate_remaining_range(
            fuel_level_l=0.0,
            expected_efficiency_kmpl=4.5,
            vehicle_type="Truck",
        )
        self.assertGreaterEqual(res["estimated_range_km"], 0.0)
        self.assertEqual(res["estimated_range_km"], 0.0)
        self.assertTrue(res["refuel_required"])
        self.assertIsNotNone(res["refuel_warning"])

    def test_adequate_fuel_range_no_warning(self):
        """When fuel level is abundant, no refuel required flag or warning is generated."""
        res = estimate_remaining_range(
            fuel_level_l=180.0,
            expected_efficiency_kmpl=4.0,
            vehicle_type="Truck",
            fuel_capacity_l=240.0,
            trip_remaining_distance_km=100.0,
        )
        self.assertGreaterEqual(res["estimated_range_km"], 700.0)
        self.assertFalse(res["refuel_required"])
        self.assertIsNone(res["refuel_warning"])

    def test_insufficient_fuel_for_route_triggers_warning(self):
        """When range is less than required route distance + buffer, caution warning triggers."""
        res = estimate_remaining_range(
            fuel_level_l=50.0,            # 20.8% of tank (not low fuel by % alone)
            expected_efficiency_kmpl=4.0,  # ~200 km range
            vehicle_type="Truck",
            fuel_capacity_l=240.0,
            trip_remaining_distance_km=220.0,  # 220 km needed > 200 km range
        )
        self.assertTrue(res["refuel_required"])
        self.assertIsNotNone(res["refuel_warning"])
        self.assertIn("insufficient", res["refuel_warning"].lower())


if __name__ == "__main__":
    unittest.main()
