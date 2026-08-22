"""
GreenFleet AI - Fleet & Route Management API Router
===================================================
Endpoints to fetch, list, and register Vehicles and Routes.
"""

import json
import os
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from backend.app.models.schemas import Vehicle, Route
from backend.app.models.vehicle import VehicleModel
from backend.app.core import vehicle_registry

router = APIRouter(prefix="/fleet", tags=["Fleet & Routes"])

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load_sample_routes() -> List[Route]:
    filepath = os.path.join(DATA_DIR, "sample_routes.json")
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [Route(**r) for r in data]
    return []


# Vehicles are persisted in SQLite (backend/app/core/vehicle_registry.py) so a
# registration survives a restart and is visible to /api/simulate/optimize.
# Routes remain an in-memory list seeded from the sample file (unaffected by
# vehicle registration, and orthogonal to the demand-scenario simulation).
_routes_store: List[Route] = _load_sample_routes()


def _model_to_schema(v: VehicleModel) -> Vehicle:
    return Vehicle(
        vehicle_id=v.vehicle_id,
        vehicle_type=v.vehicle_type,
        fuel_type=v.fuel_type,
        vehicle_age=v.vehicle_age,
        fuel_capacity_l=v.fuel_capacity_l,
        max_payload_kg=v.max_payload_kg,
        available=v.available,
    )


@router.get("", response_model=List[Vehicle])
@router.get("/vehicles", response_model=List[Vehicle])
def get_vehicles(
    available_only: Optional[bool] = None,
    vehicle_type: Optional[str] = None,
):
    """Retrieve list of registered fleet vehicles (persisted in SQLite)."""
    vehicles = vehicle_registry.list_vehicles()
    if isinstance(available_only, bool):
        vehicles = [v for v in vehicles if v.available == available_only]
    if isinstance(vehicle_type, str) and vehicle_type:
        vehicles = [v for v in vehicles if v.vehicle_type.lower() == vehicle_type.lower()]
    return [_model_to_schema(v) for v in vehicles]


@router.post("/vehicles", response_model=Vehicle, status_code=201)
def add_vehicle(vehicle: Vehicle):
    """Register a new vehicle. Persisted to SQLite and immediately visible to
    /api/simulate/optimize (the same registry simulation/engine.py reads from)."""
    try:
        saved = vehicle_registry.add_vehicle(VehicleModel(**vehicle.model_dump()))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _model_to_schema(saved)


@router.get("/routes", response_model=List[Route])
def get_routes(
    min_priority: Optional[int] = None,
):
    """Retrieve list of demand routes."""
    routes = _routes_store
    if isinstance(min_priority, int):
        routes = [r for r in routes if r.priority >= min_priority]
    return routes


@router.post("/routes", response_model=Route, status_code=201)
def add_route(route: Route):
    """Add a new route requiring assignment."""
    for r in _routes_store:
        if r.route_id == route.route_id:
            raise HTTPException(status_code=409, detail=f"Route {route.route_id} already exists.")
    _routes_store.append(route)
    return route
