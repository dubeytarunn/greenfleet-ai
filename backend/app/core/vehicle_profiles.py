"""
GreenFleet AI — Vehicle-type engine/emission profiles
======================================================
Single source of truth mapping a vehicle's `vehicle_type` to the
engine/combustion characteristics that affect fuel burn and CO2 output.
Used by the physics-fallback fuel predictor (`core/integration.py`) and
exposed to the frontend so a user picking a vehicle type can see its
effect before registering the vehicle.

`combustion_efficiency` — fraction of fuel energy converted to useful work
(higher = cleaner/more efficient engine, lower base fuel burn).
`co2_emission_factor` — multiplier on top of the fuel-type's kg CO2/litre
factor, capturing heavier engines/after-treatment systems that run richer
or idle more (e.g. hazmat trucks idling for safety checks).
`fuel_multiplier` — multiplier on the base L/100km rate for this vehicle
type, capturing drivetrain load (payload class, aerodynamics, axle count).
"""

from typing import Dict, TypedDict


class VehicleTypeProfile(TypedDict):
    label: str
    engine_type: str
    base_l_per_100km: float
    combustion_efficiency: float
    co2_emission_factor: float
    fuel_multiplier: float
    description: str


VEHICLE_TYPES = ["Standard", "Van", "Commercial Truck", "Hazmat truck", "Semi-Trailer"]

VEHICLE_TYPE_PROFILES: Dict[str, VehicleTypeProfile] = {
    "Standard": {
        "label": "Standard",
        "engine_type": "Light-duty ICE/Hybrid",
        "base_l_per_100km": 8.5,
        "combustion_efficiency": 0.88,
        "co2_emission_factor": 1.0,
        "fuel_multiplier": 1.0,
        "description": "Cars and small vehicles — best-in-class combustion efficiency, lowest emission factor.",
    },
    "Van": {
        "label": "Van",
        "engine_type": "Light-commercial ICE",
        "base_l_per_100km": 10.5,
        "combustion_efficiency": 0.82,
        "co2_emission_factor": 1.08,
        "fuel_multiplier": 1.1,
        "description": "Light commercial vans — moderate payload, slightly higher drag/load than a Standard vehicle.",
    },
    "Commercial Truck": {
        "label": "Commercial Truck",
        "engine_type": "Medium-duty Diesel",
        "base_l_per_100km": 26.0,
        "combustion_efficiency": 0.68,
        "co2_emission_factor": 1.35,
        "fuel_multiplier": 1.4,
        "description": "Medium/heavy trucks — larger diesel engines, higher payload class, lower thermal efficiency.",
    },
    "Hazmat truck": {
        "label": "Hazmat Truck",
        "engine_type": "Heavy-duty Diesel (certified)",
        "base_l_per_100km": 30.0,
        "combustion_efficiency": 0.62,
        "co2_emission_factor": 1.55,
        "fuel_multiplier": 1.55,
        "description": "Hazmat-certified trucks — extra safety idling, containment systems, and axle weight raise both fuel burn and CO2 per km.",
    },
    "Semi-Trailer": {
        "label": "Semi-Trailer",
        "engine_type": "Heavy-duty Diesel",
        "base_l_per_100km": 36.0,
        "combustion_efficiency": 0.60,
        "co2_emission_factor": 1.65,
        "fuel_multiplier": 1.7,
        "description": "Articulated long-haul trucks — highest payload class, highest fuel burn and CO2 per km.",
    },
}

_DEFAULT_PROFILE: VehicleTypeProfile = {
    "label": "Other",
    "engine_type": "Unspecified",
    "base_l_per_100km": 22.0,
    "combustion_efficiency": 0.75,
    "co2_emission_factor": 1.2,
    "fuel_multiplier": 1.2,
    "description": "Vehicle type not in the standard profile table — using fleet-average assumptions.",
}


def get_vehicle_profile(vehicle_type: str) -> VehicleTypeProfile:
    """Looks up the engine/emission profile for a vehicle type, falling back
    to a fleet-average profile for legacy/unrecognised type strings (e.g.
    older seed data using 'Light Commercial' or 'Bus') so nothing breaks."""
    return VEHICLE_TYPE_PROFILES.get(vehicle_type, _DEFAULT_PROFILE)
