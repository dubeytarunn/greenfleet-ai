"""
GreenFleet AI — Per-vehicle driving-behavior registry
========================================================
Persists driving-style telemetry samples (brake frequency, gear irregularity,
harsh acceleration) per vehicle, and derives a rolling behavior score and a
`behavior_multiplier` that inflates predicted fuel/CO2 for badly-driven
vehicles — the same rolling-average idea `LiveTab.jsx`'s `computeDriverBehaviour`
already fabricates client-side, now persisted server-side and actually fed
into the optimizer's cost matrix (see `integration.py::predict_fuel_and_co2`).
"""

from typing import List, Optional

from backend.app.core.db import get_session, init_db
from backend.app.models.db_models import BehaviorLogORM

ROLLING_WINDOW = 5


def _score(brake_freq: float, gear_irregularity: float, harsh_accel: float) -> float:
    """Mirrors the existing client-side formula in LiveTab.jsx's
    computeDriverBehaviour(), so a persisted score means the same thing the
    UI already displays."""
    raw = 100 - brake_freq * 3 - gear_irregularity * 0.6 - harsh_accel * 4
    return max(25.0, min(98.0, round(raw, 1)))


def log_sample(vehicle_id: str, brake_freq: float, gear_irregularity: float, harsh_accel: float) -> float:
    """Records one telemetry sample and returns its computed score."""
    init_db()
    score = _score(brake_freq, gear_irregularity, harsh_accel)
    session = get_session()
    try:
        session.add(BehaviorLogORM(
            vehicle_id=vehicle_id,
            brake_freq=brake_freq,
            gear_irregularity=gear_irregularity,
            harsh_accel=harsh_accel,
            score=score,
        ))
        session.commit()
        return score
    finally:
        session.close()


def get_recent_samples(vehicle_id: str, limit: int = ROLLING_WINDOW) -> List[BehaviorLogORM]:
    init_db()
    session = get_session()
    try:
        return (
            session.query(BehaviorLogORM)
            .filter_by(vehicle_id=vehicle_id)
            .order_by(BehaviorLogORM.id.desc())
            .limit(limit)
            .all()
        )
    finally:
        session.close()


def get_rolling_score(vehicle_id: str) -> Optional[float]:
    """Average score over the last ROLLING_WINDOW samples, or None if no
    telemetry has been logged for this vehicle yet."""
    samples = get_recent_samples(vehicle_id)
    if not samples:
        return None
    return round(sum(s.score for s in samples) / len(samples), 1)


def get_behavior_multiplier(vehicle_id: str) -> float:
    """1.0 for no data / good driving (score >= 70); scales up to ~1.45 at the
    worst possible score (25), inflating predicted fuel/CO2 proportionally so
    the optimizer naturally reassigns badly-driven vehicles to shorter or
    lower-priority routes (or swaps them out) on the next optimize run."""
    score = get_rolling_score(vehicle_id)
    if score is None:
        return 1.0
    return round(1.0 + max(0.0, (70.0 - score) / 100.0), 3)
