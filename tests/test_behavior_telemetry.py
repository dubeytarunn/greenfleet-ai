"""Tests for the persisted per-vehicle driving-behavior registry and its
effect on predicted fuel/CO2 via integration.py."""

import os
import sys

import pytest

from backend.app.core import behavior_registry


@pytest.fixture(autouse=True)
def _isolated_db(tmp_path, monkeypatch):
    """Point the SQLite DB at a throwaway file per test so telemetry samples
    from one test don't bleed into another."""
    import backend.app.core.db as db_module
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    test_db_path = tmp_path / "test_greenfleet.db"
    engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})
    monkeypatch.setattr(db_module, "engine", engine)
    monkeypatch.setattr(db_module, "SessionLocal", sessionmaker(bind=engine, autoflush=False, autocommit=False))
    yield


def test_good_driving_gives_neutral_multiplier():
    behavior_registry.log_sample("V001", brake_freq=2.0, gear_irregularity=5.0, harsh_accel=0)
    assert behavior_registry.get_behavior_multiplier("V001") == 1.0


def test_bad_driving_inflates_multiplier():
    for _ in range(5):
        behavior_registry.log_sample("V002", brake_freq=15.0, gear_irregularity=70.0, harsh_accel=6)
    score = behavior_registry.get_rolling_score("V002")
    assert score is not None and score < 50
    multiplier = behavior_registry.get_behavior_multiplier("V002")
    assert multiplier > 1.0


def test_no_samples_is_neutral():
    assert behavior_registry.get_rolling_score("V_UNSEEN") is None
    assert behavior_registry.get_behavior_multiplier("V_UNSEEN") == 1.0


def test_rolling_window_uses_recent_samples_only():
    # Start bad, then improve — rolling score should reflect the improvement.
    for _ in range(5):
        behavior_registry.log_sample("V003", brake_freq=15.0, gear_irregularity=70.0, harsh_accel=6)
    bad_score = behavior_registry.get_rolling_score("V003")
    for _ in range(5):
        behavior_registry.log_sample("V003", brake_freq=1.0, gear_irregularity=2.0, harsh_accel=0)
    good_score = behavior_registry.get_rolling_score("V003")
    assert good_score > bad_score


def test_behavior_multiplier_inflates_predictions():
    """End-to-end: a badly-driven vehicle's predicted fuel/CO2 should be
    higher than an identical vehicle with no telemetry history."""
    from backend.app.core.integration import predict_fuel_and_co2
    from backend.app.models.vehicle import VehicleModel
    from backend.app.models.route import RouteModel

    for _ in range(5):
        behavior_registry.log_sample("V_BAD", brake_freq=15.0, gear_irregularity=70.0, harsh_accel=6)

    good = VehicleModel(vehicle_id="V_GOOD", vehicle_type="Van", fuel_type="Diesel",
                         vehicle_age=2, fuel_capacity_l=80, max_payload_kg=1500, available=True)
    bad = VehicleModel(vehicle_id="V_BAD", vehicle_type="Van", fuel_type="Diesel",
                        vehicle_age=2, fuel_capacity_l=80, max_payload_kg=1500, available=True)
    route = RouteModel(route_id="R_TEST", origin="Depot", destination="Zone",
                        distance_km=30, required_payload_kg=800, traffic_factor=1.1, priority=1)

    preds = predict_fuel_and_co2([good, bad], [route])
    good_pred = next(p for p in preds if p.vehicle_id == "V_GOOD")
    bad_pred = next(p for p in preds if p.vehicle_id == "V_BAD")

    assert bad_pred.predicted_fuel_l > good_pred.predicted_fuel_l
    assert bad_pred.estimated_co2_kg > good_pred.estimated_co2_kg
