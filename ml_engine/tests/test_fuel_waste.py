"""
Unit Tests for Fuel Waste & Impact Estimation:
- Test 10: Fuel waste cannot become negative under any conditions
- Financial cost in INR is non-negative
- CO2 emissions impact is non-negative
- Fuel deviation % calculation accuracy
"""

import os
import sys
import unittest

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.fuel_waste_estimator import estimate_fuel_waste, calculate_fuel_deviation_pct


class TestFuelWaste(unittest.TestCase):

    def test_fuel_waste_non_negative_when_eco_driving(self):
        """Test 10: When actual fuel < expected (super eco driving), fuel_wasted_l must remain 0.0, never negative."""
        telemetry = {
            "vehicle_id": "V001",
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "speed_kmph": 55.0,
            "fuel_rate_lph": 12.0,  # Lower than expected baseline (~18 L/h)
        }
        # Provide expected metrics higher than actual
        expected = {"expected_fuel_rate_lph": 18.0}
        waste = estimate_fuel_waste(telemetry, expected_metrics=expected)

        self.assertGreaterEqual(waste["fuel_wasted_l"], 0.0)
        self.assertEqual(waste["fuel_wasted_l"], 0.0)
        self.assertEqual(waste["estimated_cost_inr"], 0.0)
        self.assertEqual(waste["co2_emissions_kg"], 0.0)
        self.assertLess(waste["fuel_deviation_pct"], 0.0)  # Negative deviation (good)
        self.assertFalse(waste["is_wasting_fuel"])

    def test_fuel_waste_calculated_when_inefficient(self):
        """When actual fuel exceeds expected, wasted litres, cost (INR), and CO2 are positively calculated."""
        telemetry = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "fuel_type": "Diesel",
                "speed_kmph": 50.0,
                "fuel_rate_lph": 30.0,  # 12 L/h above expected (18 L/h)
            }
            for _ in range(15)  # 15 seconds window
        ]
        expected = {"expected_fuel_rate_lph": 18.0}
        waste = estimate_fuel_waste(telemetry, expected_metrics=expected, fuel_price_inr=89.50)

        self.assertGreater(waste["fuel_wasted_l"], 0.0)
        self.assertGreater(waste["estimated_cost_inr"], 0.0)
        self.assertGreater(waste["co2_emissions_kg"], 0.0)
        self.assertGreater(waste["fuel_deviation_pct"], 50.0)
        self.assertTrue(waste["is_wasting_fuel"])

    def test_deviation_percentage_formula(self):
        """Verify standard deviation calculation ((actual - expected) / expected) * 100."""
        dev1 = calculate_fuel_deviation_pct(actual_fuel=25.0, expected_fuel=20.0)
        self.assertEqual(dev1, 25.0)

        dev2 = calculate_fuel_deviation_pct(actual_fuel=15.0, expected_fuel=20.0)
        self.assertEqual(dev2, -25.0)


if __name__ == "__main__":
    unittest.main()
