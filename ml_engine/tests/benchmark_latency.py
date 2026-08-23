"""
GreenFlow AI - Real-Time Latency & Low-Latency Benchmark Suite
Evaluates inference performance across individual frames and rolling windows,
reporting Mean, Median, P95, P99, and Maximum latency metrics.
"""

import os
import sys
import time
from typing import Dict, Any, List
import numpy as np

# Ensure ml_engine directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from inference.fuel_predictor import predict_fuel_consumption, load_telemetry_model
from alerts.alert_engine import process_telemetry, AlertEngine


def run_latency_benchmark(num_iterations: int = 500) -> Dict[str, Any]:
    """
    Measures and profiles execution latency for:
    1. Single-frame expected fuel model prediction
    2. End-to-end telemetry window processing (ML baseline + behavior + waste + alerts)
    """
    # Pre-warm model cache
    load_telemetry_model()

    sample_frame = {
        "vehicle_id": "V_BENCHMARK",
        "vehicle_type": "Truck",
        "fuel_type": "Diesel",
        "speed_kmph": 58.0,
        "acceleration_mps2": 1.1,
        "rpm": 1750.0,
        "gear": 5,
        "engine_load_pct": 60.0,
        "road_slope_pct": 0.5,
        "road_type": "Highway",
        "traffic_level": "Medium",
        "vehicle_age_years": 4,
        "engine_size_l": 6.7,
        "vehicle_weight_kg": 9500.0,
        "ambient_temperature_c": 28.0,
        "idle_duration_sec": 0,
        "fuel_rate_lph": 22.0,
        "fuel_level_l": 120.0,
    }

    # Warm up runs
    for _ in range(25):
        predict_fuel_consumption(sample_frame)
        process_telemetry([sample_frame])

    # 1. Single Frame Model Inference Latency
    frame_latencies_ms = []
    for _ in range(num_iterations):
        t0 = time.perf_counter()
        predict_fuel_consumption(sample_frame)
        t1 = time.perf_counter()
        frame_latencies_ms.append((t1 - t0) * 1000.0)

    # 2. End-to-End Rolling Window Processing Latency (15 samples)
    window_15 = [sample_frame.copy() for _ in range(15)]
    window_latencies_ms = []
    engine = AlertEngine()

    for _ in range(min(200, num_iterations)):
        t0 = time.perf_counter()
        engine.process(window_15)
        t1 = time.perf_counter()
        window_latencies_ms.append((t1 - t0) * 1000.0)

    stats = {
        "single_frame_ml": {
            "iterations": len(frame_latencies_ms),
            "mean_ms": round(float(np.mean(frame_latencies_ms)), 3),
            "median_ms": round(float(np.median(frame_latencies_ms)), 3),
            "p95_ms": round(float(np.percentile(frame_latencies_ms, 95)), 3),
            "p99_ms": round(float(np.percentile(frame_latencies_ms, 99)), 3),
            "max_ms": round(float(np.max(frame_latencies_ms)), 3),
        },
        "end_to_end_window_alert": {
            "iterations": len(window_latencies_ms),
            "mean_ms": round(float(np.mean(window_latencies_ms)), 3),
            "median_ms": round(float(np.median(window_latencies_ms)), 3),
            "p95_ms": round(float(np.percentile(window_latencies_ms, 95)), 3),
            "p99_ms": round(float(np.percentile(window_latencies_ms, 99)), 3),
            "max_ms": round(float(np.max(window_latencies_ms)), 3),
        },
    }

    print("\n=======================================================")
    print("      GREENFLOW AI - ML ENGINE LATENCY BENCHMARK       ")
    print("=======================================================")
    print("1. Single Frame ML Inference (LightGBM/GBDT):")
    print(f"   - Mean Latency:   {stats['single_frame_ml']['mean_ms']:.2f} ms")
    print(f"   - P95 Latency:    {stats['single_frame_ml']['p95_ms']:.2f} ms")
    print(f"   - Max Latency:    {stats['single_frame_ml']['max_ms']:.2f} ms")
    print("\n2. End-to-End Alert Engine Pipeline (15-sample Window):")
    print(f"   - Mean Latency:   {stats['end_to_end_window_alert']['mean_ms']:.2f} ms")
    print(f"   - P95 Latency:    {stats['end_to_end_window_alert']['p95_ms']:.2f} ms")
    print(f"   - Max Latency:    {stats['end_to_end_window_alert']['max_ms']:.2f} ms")
    print("=======================================================\n")

    return stats


if __name__ == "__main__":
    run_latency_benchmark()
