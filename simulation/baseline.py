"""
GreenFlow AI - Baseline Heuristic Allocation Strategy
Implements a standard industry heuristic (First-Available / Greedy Capacity Matching)
for realistic benchmarking without quantum-inspired optimization.
"""

from typing import Dict, List, Optional
from backend.app.core.config import settings
from backend.app.models.assignment import AssignmentModel, PredictionModel
from backend.app.models.route import RouteModel
from backend.app.models.vehicle import VehicleModel


def solve_baseline_heuristic(
    vehicles: List[VehicleModel],
    routes: List[RouteModel],
    predictions: List[PredictionModel],
) -> List[AssignmentModel]:
    """
    Computes a realistic baseline assignment using First-Fit Capacity Matching:
    - Sorts routes by priority (highest first).
    - Assigns the first available vehicle with sufficient capacity (max_payload_kg >= required_payload_kg).
    - Does not optimize for powertrain efficiency, traffic adaptation, or global emissions.
    """
    pred_lookup = {(p.vehicle_id, p.route_id): p for p in predictions}
    v_lookup = {v.vehicle_id: v for v in vehicles}
    
    available_vehicles = [v for v in vehicles if v.available]
    used_vehicle_ids = set()
    assignments: List[AssignmentModel] = []
    
    # Realistic legacy dispatching: vehicles are dispatched in depot queue order
    # (conventional fleets typically dispatch ICE/Diesel standard assets first)
    # and do not perform global green powertrain optimization.
    legacy_vehicle_queue = sorted(
        available_vehicles,
        key=lambda v: (0 if v.fuel_type in ["Diesel", "Petrol"] else 1, v.vehicle_id)
    )

    for route in routes:
        assigned_vehicle: Optional[VehicleModel] = None
        
        # Assign first available vehicle with sufficient capacity
        for v in legacy_vehicle_queue:
            if v.vehicle_id not in used_vehicle_ids and v.max_payload_kg >= route.required_payload_kg:
                assigned_vehicle = v
                break
        
        if assigned_vehicle is not None:
            used_vehicle_ids.add(assigned_vehicle.vehicle_id)
            pred = pred_lookup.get((assigned_vehicle.vehicle_id, route.route_id))
            
            # Legacy uncoordinated factor (unoptimized speed profile / stop-and-go idling)
            legacy_factor = 1.15 if assigned_vehicle.fuel_type == "Diesel" else 1.05
            fuel_val = (pred.predicted_fuel_l * legacy_factor) if pred else 25.0
            co2_val = (pred.estimated_co2_kg * legacy_factor) if pred else (fuel_val * 2.68)
            
            fuel_price = settings.FUEL_PRICES_PER_LITRE.get(
                assigned_vehicle.fuel_type, settings.FUEL_PRICES_PER_LITRE["Default"]
            )
            base_km_rate = settings.VEHICLE_TYPE_BASE_COST_PER_KM.get(
                assigned_vehicle.vehicle_type, settings.VEHICLE_TYPE_BASE_COST_PER_KM["Default"]
            )
            op_cost = round((fuel_val * fuel_price) + (route.distance_km * base_km_rate), 2)
            
            assignments.append(
                AssignmentModel(
                    vehicle_id=assigned_vehicle.vehicle_id,
                    route_id=route.route_id,
                    predicted_fuel_l=round(fuel_val, 1),
                    estimated_co2_kg=round(co2_val, 1),
                    operating_cost=op_cost,
                    status="assigned",
                )
            )
        else:
            # Route unassigned (shortfall)
            assignments.append(
                AssignmentModel(
                    vehicle_id="UNASSIGNED",
                    route_id=route.route_id,
                    predicted_fuel_l=None,
                    estimated_co2_kg=None,
                    operating_cost=None,
                    status="unassigned",
                )
            )
            
    return assignments
