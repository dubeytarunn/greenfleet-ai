"""
Unit Tests for Central Alert Engine:
- Test 7: Persistent inefficient behavior causes alert severity to escalate (INFO -> WARNING -> CRITICAL)
- Test 8: Inefficient behavior ceases -> alert clears and downgrades back to NORMAL
- Debouncing and stateful persistence
"""

import os
import sys
import unittest

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alerts.alert_engine import AlertEngine


class TestAlertEngine(unittest.TestCase):

    def setUp(self):
        self.engine = AlertEngine()

    def test_alert_escalation_and_clearing(self):
        """Test 7 & 8: Verify persistence escalation and subsequent clearing back to NORMAL."""
        vehicle_id = "V_ESCALATION_TEST"

        harsh_frame = {
            "vehicle_id": vehicle_id,
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "speed_kmph": 45.0,
            "acceleration_mps2": 2.6,
            "rpm": 2000.0,
            "gear": 4,
            "engine_load_pct": 70.0,
            "road_slope_pct": 0.0,
            "road_type": "Highway",
            "traffic_level": "Medium",
            "throttle_position_pct": 75.0,
            "brake_pressure_pct": 0.0,
            "fuel_rate_lph": 10.5,  # ~29% deviation (>25% WARNING, <45% CRITICAL)
            "fuel_level_l": 80.0,
            "idle_duration_sec": 0,
        }

        # Step 1: Initial occurrence (short window) -> starts at INFO or WARNING
        initial_window = [harsh_frame.copy() for _ in range(5)]
        res1 = self.engine.process(initial_window)
        self.assertIn(res1["severity"], ["INFO", "WARNING"])
        self.assertEqual(res1["behaviour"], "harsh_acceleration")

        # Step 2: Sustained persistent occurrences (65 samples >= 60s) -> escalates to CRITICAL
        long_window = [harsh_frame.copy() for _ in range(65)]
        res2 = self.engine.process(long_window)
        self.assertEqual(res2["severity"], "CRITICAL")
        self.assertGreater(res2["fuel_wasted_l"], 0.0)
        self.assertGreater(res2["estimated_cost_inr"], 0.0)

        # Step 3 (Test 8): Driver resumes normal smooth driving -> clears back to NORMAL
        normal_frame = {
            "vehicle_id": vehicle_id,
            "vehicle_type": "Truck",
            "fuel_type": "Diesel",
            "speed_kmph": 55.0,
            "acceleration_mps2": 0.0,
            "rpm": 1500.0,
            "gear": 5,
            "engine_load_pct": 45.0,
            "road_slope_pct": 0.0,
            "road_type": "Highway",
            "traffic_level": "Medium",
            "throttle_position_pct": 25.0,
            "brake_pressure_pct": 0.0,
            "fuel_rate_lph": 8.0,  # Normal cruise consumption
            "fuel_level_l": 79.5,
            "idle_duration_sec": 0,
        }
        normal_window = [normal_frame.copy() for _ in range(15)]
        res3 = self.engine.process(normal_window)

        self.assertEqual(res3["behaviour"], "normal")
        self.assertEqual(res3["severity"], "NORMAL")
        self.assertEqual(res3["fuel_wasted_l"], 0.0)
        self.assertIn("Optimal", res3["message"])


if __name__ == "__main__":
    unittest.main()
