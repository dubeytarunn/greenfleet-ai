"""
GreenFleet AI — Optimisation entry point
=========================================

Owner: Person 3 (Quantum Optimisation)
File:  backend/app/core/optimizer.py

Success condition: given predicted vehicle-route fuel values, produce valid
vehicle-route assignments.

This is the single function the rest of the team should call — it hides the
solver choice (Simulated Annealing vs. exact MILP/Hungarian, both in
`quantum_optimizer.py`) and the verification step behind one call, so
callers never need to know about `QuantumInspiredOptimizer` internals.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from .quantum_optimizer import (
    AssignmentResult,
    OptimizationConfig,
    Prediction,
    QuantumInspiredOptimizer,
    Route,
    Vehicle,
)

logger = logging.getLogger(__name__)


def optimize_routes(
    vehicles: List[Vehicle],
    routes: List[Route],
    predictions: List[Prediction],
    config: Optional[OptimizationConfig] = None,
    method: str = "quantum_inspired",
) -> List[Dict[str, object]]:
    """
    Given predicted vehicle-route fuel values, produce valid vehicle-route
    assignments.

    Args:
        vehicles: fleet to assign from.
        routes: routes that need a vehicle.
        predictions: Person 1's per (vehicle_id, route_id) fuel/CO2 output.
        config: solver tuning knobs; defaults to `OptimizationConfig()`.
        method: "quantum_inspired" | "classical_baseline" | "milp" |
                "hungarian" | "simulated_annealing"

    Returns:
        The locked Assignment contract, one row per assigned route:
        [{"vehicle_id", "route_id", "predicted_fuel_l", "status"}, ...]

    Notes:
        Partial assignments (e.g. more routes than vehicles, or all vehicles
        unavailable) are returned as-is rather than raising.  The caller
        receives an empty or partial list and surfaces it via solver_status.
    """
    optimizer = QuantumInspiredOptimizer(vehicles, routes, predictions, config)

    result: AssignmentResult
    if method == "quantum_inspired":
        result = optimizer.solve_simulated_annealing()
        verification = optimizer.verify_solution(result)
        if not verification["is_valid"]:
            result = optimizer.solve_classical_baseline()
    elif method in ("classical_baseline", "milp"):
        result = optimizer.solve_classical_baseline()
    elif method == "hungarian":
        result = optimizer._solve_hungarian()
    elif method == "simulated_annealing":
        result = optimizer.solve_simulated_annealing()
    else:
        raise ValueError(f"Unknown method: {method!r}")

    verification = optimizer.verify_solution(result)
    if not verification["is_valid"]:
        # Log but don't crash — return best-effort partial result so the
        # API always returns 200 with whatever assignments were feasible.
        logger.warning(
            "Optimizer returned a partial/constrained solution (%s): %s",
            result.method,
            verification["details"],
        )

    return optimizer.to_assignment_list(result)
