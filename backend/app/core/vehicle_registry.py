"""
GreenFleet AI — Persistent vehicle registry
=============================================
Single source of truth for the fleet's vehicle roster, backed by SQLite.
Used by both `backend/app/api/fleet.py` (registration REST endpoint) and
`simulation/engine.py` (so a registered vehicle actually participates in
`/api/simulate/optimize`, not just a disconnected admin list).

Seeded once, on first run, from `simulation.dataset.get_initial_fleet()` —
the richer 20-vehicle dataset the simulation engine already used — so both
consumers share one dataset instead of two incompatible ones.
"""

from typing import List, Optional

from backend.app.core.db import get_session, init_db
from backend.app.models.db_models import VehicleORM
from backend.app.models.vehicle import VehicleModel

_seeded = False


def _orm_to_model(row: VehicleORM) -> VehicleModel:
    return VehicleModel(
        vehicle_id=row.vehicle_id,
        vehicle_type=row.vehicle_type,
        fuel_type=row.fuel_type,
        vehicle_age=row.vehicle_age,
        fuel_capacity_l=row.fuel_capacity_l,
        max_payload_kg=row.max_payload_kg,
        available=row.available,
        current_location=row.current_location,
        operating_cost_per_km=row.operating_cost_per_km,
        fuel_efficiency_kmpl=row.fuel_efficiency_kmpl,
    )


def ensure_seeded() -> None:
    """Creates tables and seeds the registry from the deterministic fleet
    dataset on first run only. Idempotent — safe to call on every request."""
    global _seeded
    if _seeded:
        return
    init_db()
    session = get_session()
    try:
        if session.query(VehicleORM).count() == 0:
            from simulation.dataset import get_initial_fleet
            for v in get_initial_fleet():
                session.add(VehicleORM(
                    vehicle_id=v.vehicle_id,
                    vehicle_type=v.vehicle_type,
                    fuel_type=v.fuel_type,
                    vehicle_age=v.vehicle_age,
                    fuel_capacity_l=v.fuel_capacity_l,
                    max_payload_kg=v.max_payload_kg,
                    available=v.available,
                    current_location=v.current_location,
                    operating_cost_per_km=v.operating_cost_per_km,
                    fuel_efficiency_kmpl=v.fuel_efficiency_kmpl,
                ))
            session.commit()
        _seeded = True
    finally:
        session.close()


def list_vehicles() -> List[VehicleModel]:
    ensure_seeded()
    session = get_session()
    try:
        return [_orm_to_model(row) for row in session.query(VehicleORM).all()]
    finally:
        session.close()


def vehicle_exists(vehicle_id: str) -> bool:
    ensure_seeded()
    session = get_session()
    try:
        return session.query(VehicleORM).filter_by(vehicle_id=vehicle_id).first() is not None
    finally:
        session.close()


def add_vehicle(vehicle: VehicleModel) -> VehicleModel:
    """Registers a new vehicle. Raises ValueError if the ID already exists."""
    ensure_seeded()
    session = get_session()
    try:
        if session.query(VehicleORM).filter_by(vehicle_id=vehicle.vehicle_id).first():
            raise ValueError(f"Vehicle {vehicle.vehicle_id} already exists.")
        row = VehicleORM(
            vehicle_id=vehicle.vehicle_id,
            vehicle_type=vehicle.vehicle_type,
            fuel_type=vehicle.fuel_type,
            vehicle_age=vehicle.vehicle_age,
            fuel_capacity_l=vehicle.fuel_capacity_l,
            max_payload_kg=vehicle.max_payload_kg,
            available=vehicle.available,
            current_location=vehicle.current_location or "Depot Central",
            operating_cost_per_km=vehicle.operating_cost_per_km,
            fuel_efficiency_kmpl=vehicle.fuel_efficiency_kmpl,
        )
        session.add(row)
        session.commit()
        return _orm_to_model(row)
    finally:
        session.close()
