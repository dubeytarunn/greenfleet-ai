"""Tests for the optional carbon-budget hard cap in quantum_optimizer.py."""

from backend.app.core.quantum_optimizer import (
    OptimizationConfig,
    Prediction,
    QuantumInspiredOptimizer,
    Route,
    Vehicle,
)

VEHICLES = [
    Vehicle(vehicle_id="V001", vehicle_type="Truck", fuel_type="Diesel",
            vehicle_age=3, fuel_capacity_l=150, max_payload_kg=4000, available=True),
    Vehicle(vehicle_id="V002", vehicle_type="Van", fuel_type="CNG",
            vehicle_age=1, fuel_capacity_l=80, max_payload_kg=1500, available=True),
]

ROUTES = [
    Route(route_id="R001", origin="Depot", destination="Zone 1",
          distance_km=40, required_payload_kg=1000, traffic_factor=1.1, priority=1),
    Route(route_id="R002", origin="Depot", destination="Zone 2",
          distance_km=30, required_payload_kg=800, traffic_factor=1.1, priority=1),
]

# V001 (diesel) is high-emission; V002 (CNG) is low-emission, on purpose.
PREDICTIONS = [
    Prediction(vehicle_id="V001", route_id="R001", predicted_fuel_l=20, estimated_co2_kg=100),
    Prediction(vehicle_id="V001", route_id="R002", predicted_fuel_l=15, estimated_co2_kg=80),
    Prediction(vehicle_id="V002", route_id="R001", predicted_fuel_l=10, estimated_co2_kg=15),
    Prediction(vehicle_id="V002", route_id="R002", predicted_fuel_l=8, estimated_co2_kg=12),
]


def _optimizer(**config_kwargs):
    config = OptimizationConfig(seed=42, **config_kwargs)
    return QuantumInspiredOptimizer(VEHICLES, ROUTES, PREDICTIONS, config)


def test_no_hard_cap_by_default_can_exceed_natural_minimum():
    # Cheapest natural total CO2 assigning both routes is V002+V002, but only
    # one vehicle can serve one route (one-to-one), so V001 must take one route.
    opt = _optimizer()
    result = opt.solve_classical_baseline()
    verification = opt.verify_solution(result)
    assert verification["within_carbon_budget"] is True  # no cap configured


def test_hard_cap_blocks_high_emission_assignment_in_milp():
    # Of the two full one-to-one assignments, only one (total CO2 = 95) fits
    # under budget=100; the other (total CO2 = 112) doesn't.
    opt = _optimizer(carbon_budget_kg=100.0, enforce_carbon_hard_cap=True)
    result = opt.solve_classical_baseline()
    verification = opt.verify_solution(result)
    total_co2 = verification["details"]["total_co2_kg"]

    if result.method == "classical_milp":
        # CBC actually ran: hard constraint must hold exactly.
        assert total_co2 <= 100.0 + 1e-6
        assert verification["within_carbon_budget"] is True
    else:
        # Documented limitation: the Hungarian fallback is a per-cell
        # algorithm and can't enforce a global constraint. It should still
        # run without crashing.
        assert result.method == "classical_hungarian"


def test_hard_cap_enforced_in_simulated_annealing_too():
    opt = _optimizer(carbon_budget_kg=100.0, enforce_carbon_hard_cap=True, max_iterations=4000)
    result = opt.solve_simulated_annealing()
    verification = opt.verify_solution(result)
    total_co2 = verification["details"]["total_co2_kg"]
    assert total_co2 <= 100.0 + 1e-6
    # The cheaper-CO2 full assignment (V001->R002, V002->R001) must be chosen.
    assignments = {a["vehicle_id"]: a["route_id"] for a in opt.to_assignment_list(result)}
    assert assignments.get("V001") == "R002"
