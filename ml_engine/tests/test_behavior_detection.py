"""
Unit Tests for Driving Behavior Detection Engine:
- Test 1: Normal driving -> no false critical alert
- Test 2: Excessive revving -> detected
- Test 3: Harsh acceleration -> detected
- Test 4: Downhill acceleration -> detected
- Test 5: Inefficient gear -> detected
- Test 6: Excessive idling -> detected
"""

import os
import sys
import unittest

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.behavior_detector import BehaviorDetector


class TestBehaviorDetection(unittest.TestCase):

    def setUp(self):
        self.detector = BehaviorDetector(window_size_sec=15)

    def test_normal_driving_no_false_critical(self):
        """Test 1: Normal steady driving must not trigger false critical alerts."""
        normal_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 55.0,
                "acceleration_mps2": 0.1,
                "rpm": 1500.0,
                "gear": 5,
                "engine_load_pct": 45.0,
                "road_slope_pct": 0.0,
                "throttle_position_pct": 25.0,
                "brake_pressure_pct": 0.0,
                "idle_duration_sec": 0,
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(normal_window)
        self.assertEqual(result["detected_behavior"], "normal")
        self.assertNotEqual(result["severity"], "CRITICAL")
        self.assertGreaterEqual(result["behavior_score"], 85.0)

    def test_excessive_revving_detected(self):
        """Test 2: Excessive RPM relative to vehicle type is detected."""
        revving_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 30.0,
                "acceleration_mps2": 0.0,
                "rpm": 3100.0,  # Far above truck max efficient RPM (~2200)
                "gear": 2,
                "engine_load_pct": 75.0,
                "road_slope_pct": 0.0,
                "throttle_position_pct": 80.0,
                "brake_pressure_pct": 0.0,
                "idle_duration_sec": 0,
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(revving_window)
        self.assertEqual(result["detected_behavior"], "excessive_revving")
        self.assertIn(result["severity"], ["WARNING", "CRITICAL", "INFO"])

    def test_harsh_acceleration_detected(self):
        """Test 3: Harsh sustained acceleration is detected."""
        harsh_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 45.0,
                "acceleration_mps2": 3.4,  # > 2.5 m/s^2 threshold
                "rpm": 2400.0,
                "gear": 3,
                "engine_load_pct": 95.0,
                "road_slope_pct": 0.0,
                "throttle_position_pct": 95.0,
                "brake_pressure_pct": 0.0,
                "idle_duration_sec": 0,
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(harsh_window)
        self.assertEqual(result["detected_behavior"], "harsh_acceleration")

    def test_downhill_acceleration_detected(self):
        """Test 4: Downhill acceleration on negative slope is detected."""
        downhill_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 65.0,
                "acceleration_mps2": 1.2,
                "rpm": 1800.0,
                "gear": 6,
                "engine_load_pct": 55.0,
                "road_slope_pct": -3.5,  # Steep downhill
                "throttle_position_pct": 60.0,  # Pressing gas on descent
                "brake_pressure_pct": 0.0,
                "idle_duration_sec": 0,
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(downhill_window)
        self.assertEqual(result["detected_behavior"], "downhill_acceleration")

    def test_inefficient_gear_detected(self):
        """Test 5: Suboptimal gear selection (lugging engine) is detected."""
        lugging_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 22.0,  # Low speed
                "acceleration_mps2": 0.1,
                "rpm": 950.0,
                "gear": 5,          # Too high gear for 22 km/h
                "engine_load_pct": 88.0,  # High engine load
                "road_slope_pct": 1.0,
                "throttle_position_pct": 70.0,
                "brake_pressure_pct": 0.0,
                "idle_duration_sec": 0,
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(lugging_window)
        self.assertEqual(result["detected_behavior"], "inefficient_gear")

    def test_excessive_idling_detected(self):
        """Test 6: Excessive vehicle idling duration is detected."""
        idling_window = [
            {
                "vehicle_id": "V001",
                "vehicle_type": "Truck",
                "speed_kmph": 0.0,
                "acceleration_mps2": 0.0,
                "rpm": 700.0,
                "gear": 0,
                "engine_load_pct": 15.0,
                "road_slope_pct": 0.0,
                "throttle_position_pct": 0.0,
                "brake_pressure_pct": 40.0,
                "idle_duration_sec": 75,  # > 45s threshold
            }
            for _ in range(10)
        ]
        result = self.detector.analyze_window(idling_window)
        self.assertEqual(result["detected_behavior"], "excessive_idling")


if __name__ == "__main__":
    unittest.main()
