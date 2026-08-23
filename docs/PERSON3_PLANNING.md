# Person 3 (Quantum Optimisation) — Planning

**Scope:** `backend/app/core/optimizer.py`, `backend/app/core/quantum_optimizer.py`,
`docs/algorithm.md`. Success condition: given predicted vehicle-route fuel values,
produce valid vehicle-route assignments. Does not touch the React frontend or any
other team member's files.

**Status update (post-plan):** the team supplied the locked `Vehicle` / `Route` /
`Prediction` / `Assignment` JSON contracts, resolving the schema and Person 1
fuel-integration open questions below. `backend/app/core/quantum_optimizer.py` and
`docs/algorithm.md` have been implemented against those exact contracts (field names
unchanged), and `backend/app/core/optimizer.py` was added as the single public entry
point (`optimize_routes(vehicles, routes, predictions, config, method) -> [Assignment]`)
so callers don't need to know about the SA-vs-MILP solver choice. Both solvers were
smoke-tested (in a throwaway venv, cleaned up afterward) against a synthetic fixture,
including the adversarial verification case from §5 — all passed. Remaining
"blocked on teammates" items in §7 (FastAPI route registration, dashboard wiring) are
still open; sections below are otherwise superseded by the contracts, kept for
historical context.

---

## 0. Read-before-planning: repo findings

The repo (`d:\greenfleet-ai`) is currently a bare scaffold:

```
README.md
backend/app/core/quantum_optimizer.py   (empty, 0 bytes)
docs/algorithm.md                       (empty, 0 bytes)
```

**Open questions (explicitly not guessed):**

- No shared `Vehicle` / `Route` / `Trip` / `Constraint` / `Assignment` schema exists yet
  anywhere in the repo — no `models.py`, `schemas.py`, or equivalent.
- No FastAPI app or router exists (`backend/app/main.py` doesn't exist) — no confirmed
  call site or input/output contract for this module.
- No fuel-consumption prediction module or output format exists (Person 1's slice).
- No `GREENFLOW_PLANNING.md` or architecture doc describing module handoffs.

Given none of that exists yet, this plan uses **ChargeFlow AI's already-solved
equivalent module** (provided as reference material, since GreenFlow is explicitly
"architecturally transferred" from ChargeFlow and this assignment problem "mirrors
ChargeFlow's EV → charging-station assignment problem exactly") as the concrete
precedent to adapt. Every field name/type below is therefore **proposed**, not
confirmed against a teammate-owned schema — flagged again in §7 Integration Checklist.

---

## 1. Interface contract (proposed)

```python
@dataclass
class Vehicle:
    id: str
    capacity: float
    fuel_efficiency_km_per_l: float
    available: bool = True
    co2_kg_per_l: float = 2.31
    max_routes: int = 1

@dataclass
class Route:
    id: str
    distance_km: float
    required_capacity: float
    priority_weight: float = 1.0

@dataclass
class OptimizationConfig:
    fuel_weight: float = 1.0
    co2_weight: float = 1.0
    distance_weight: float = 0.3
    imbalance_weight: float = 0.5
    capacity_shortfall_penalty: float = 5_000.0
    constraint_penalty: float = 50_000.0
    initial_temp: float = 1_000.0
    cooling_rate: float = 0.995
    min_temp: float = 1e-3
    max_iterations: int = 20_000
    seed: Optional[int] = None

@dataclass
class AssignmentResult:
    assignment_matrix: np.ndarray   # shape (n_vehicles, n_routes), binary
    total_cost: float
    base_cost: float
    imbalance_penalty: float
    constraint_penalty: float
    constraint_violations: int
    runtime_seconds: float
    method: str
    iterations: int = 0
```

```python
optimizer = QuantumInspiredOptimizer(vehicles, routes, config)

optimizer.solve_simulated_annealing()   -> AssignmentResult
optimizer.solve_classical_baseline()    -> AssignmentResult
optimizer.compare()                     -> {"quantum_inspired": ..., "classical_baseline": ...}
optimizer.verify_solution(result)       -> Dict[str, object]   # checks + "is_valid" + "details"
optimizer.to_assignment_list(result)    -> [{"vehicle_id": ..., "route_id": ...}, ...]
```

`to_assignment_list()` is the intended hand-off point to the FastAPI layer once it
exists — flat `[{vehicle_id, route_id}]` pairs, independent of the matrix
representation.

---

## 2. Objective function breakdown

```
cost(x) = fuel_cost(x) + co2_penalty(x) + distance_penalty(x)
        + imbalance_penalty(x) + constraint_penalty(x)
```

| Term | Formula | Upstream fields |
|---|---|---|
| Fuel cost | `fuel_liters_ij = distance_j / fuel_efficiency_i`; `Σ x_ij · fuel_liters_ij · w_fuel` | `Route.distance_km`, `Vehicle.fuel_efficiency_km_per_l` |
| CO2 penalty | `co2_kg_ij = fuel_liters_ij · co2_factor_i`; `Σ x_ij · co2_kg_ij · w_co2` | above + `Vehicle.co2_kg_per_l` |
| Distance penalty | `Σ x_ij · distance_j · w_distance` | `Route.distance_km` |
| Capacity shortfall (folded into cell cost, not a separate sum term) | `if capacity_i < required_j: shortfall_weight · (required_j − capacity_i)` else `0.05 · (capacity_i − required_j)` | `Vehicle.capacity`, `Route.required_capacity` |
| Imbalance penalty | `w_imbalance · Var(load_1..load_N)`, `load_i = Σ_j x_ij` | derived from the matrix itself |
| Constraint penalty (SA only, soft) | `Σ_j C·|Σ_i x_ij − 1|` + `Σ_i C·max(0, load_i − max_routes_i)` + `Σ_i C·[unavailable]·load_i` | `Vehicle.max_routes`, `Vehicle.available` |

Fuel cost and CO2 penalty are the two terms that depend on **Person 1's fuel module**
once it exists — currently `fuel_efficiency_km_per_l` is assumed to arrive pre-computed
per vehicle. If Person 1's module instead outputs *per-route-per-vehicle* fuel
predictions directly (rather than a static per-vehicle efficiency figure), the cost
matrix build (`_build_cost_matrix`) changes from a formula to a lookup — this is the
single biggest integration unknown (see §7).

---

## 3. Solver plan

| Candidate | Verdict | Why |
|---|---|---|
| **Simulated Annealing** (recommended) | ✅ | Same binary QUBO decision variables a quantum annealer would use; `exp(-Δcost/T)` acceptance is the textbook classical proxy for quantum tunnelling early in the run, cooling into a low-cost basin late. Zero extra hard dependency (`random`/`math`/`numpy` only). Standard, well-documented, defensible in a report without real quantum hardware. |
| `dwave-neal` (simulated quantum annealing) | Considered, not chosen | Closer in name/marketing to "quantum," but under the hood it's the same SA algorithm with a heavier dependency and less transparent tuning knobs for a from-scratch demo. Revisit only if the team specifically wants to cite the `dwave-neal` package by name. |
| Tabu Search | Considered, not chosen | Good metaheuristic, but doesn't map as directly onto the QUBO/quantum-annealing narrative (no natural "temperature"/tunnelling analogy) — weaker story for the "quantum-inspired" framing the report needs. |

**Recommendation: Simulated Annealing.** Default schedule: `T₀ = 1000`,
`cooling_rate = 0.995`, `T_min = 1e-3`, `max_iterations = 20,000` (tunable via
`OptimizationConfig`).

Algorithm: start from a random assignment (every route → random *available* vehicle);
repeat propose-a-neighbour (reassign one random route) → accept if cheaper or with
probability `exp(-Δcost/T)` if worse → track best-seen matrix (not just current, since SA
can wander late) → cool `T ← T · cooling_rate`; stop at `T < T_min` or iteration cap;
return the best matrix found.

---

## 4. Classical baseline plan

- **Primary:** exact MILP via PuLP/CBC (`pulp.LpProblem` + `PULP_CBC_CMD`).
- **Fallback:** `scipy.optimize.linear_sum_assignment` (Hungarian algorithm) if PuLP
  isn't installed — exact only when every `max_routes == 1`; kept simple since PuLP is
  the primary path.

Hard-constraint mapping (MILP encodes these as *hard* linear constraints; SA instead
encodes the same three as the *soft* `constraint_penalty` in §2):

```
minimise   Σ x_ij · cost_ij
subject to Σ_i x_ij = 1                for every route j       (full coverage)
           Σ_j x_ij ≤ max_routes_i     for every vehicle i      (no double-booking)
           x_ij = 0                    for every unavailable vehicle i
           x_ij ∈ {0, 1}
```

This is the ground truth for benchmarking — guaranteed optimal at this instance size —
and gives SA an honest optimality gap to report:
`(SA_cost − MILP_cost) / MILP_cost`.

---

## 5. Verification suite spec

Every result (from either solver) runs through `verify_solution(result)` before being
trusted downstream. Each row below is a testable boolean function:

| Check | Catches |
|---|---|
| `shape_correct` | matrix shape ≠ `(n_vehicles, n_routes)` |
| `is_binary` | any entry not in `{0, 1}` |
| `every_route_assigned` | `Σ_i x_ij ≠ 1` for some route (dropped or double-assigned route) |
| `no_double_booking` | a vehicle's load exceeds its `max_routes` |
| `no_unavailable_vehicles_used` | an unavailable vehicle has load > 0 |
| `no_capacity_violations` | an assigned vehicle can't carry the route's required capacity |
| `no_nan_or_negative_cost` | NaN or negative `total_cost` |
| `cost_in_sane_bounds` | cost anywhere near `constraint_penalty` magnitude — a sign a violation was merely penalised, not fixed |

`verify_solution()` returns each boolean, an overall `is_valid`, and a `details` block
listing exact offending route/vehicle IDs per failed check (`unassigned_routes`,
`overassigned_routes`, `vehicles_double_booked`, `unavailable_vehicles_used`,
`capacity_violations`) — this is what gets logged if a solution is ever rejected.

**Adversarial test case (must fail, not rubber-stamp):** take a correct matrix, then
hand-corrupt it by (a) flipping an assignment onto a vehicle marked `available=False`,
and (b) assigning a vehicle to a route whose `required_capacity` exceeds its
`capacity`. `verify_solution()` must return `is_valid=False` with both the specific
vehicle/route pair for the unavailable-vehicle violation and the specific pair for the
capacity violation listed in `details`.

---

## 6. Test plan

1. **Small hand-checkable instance** — e.g. 2 vehicles, 2 routes, values chosen so the
   optimal assignment can be computed by hand and compared against both solvers'
   output.
2. **Medium random instance** — ~25 vehicles / 20 routes, randomly generated
   (`OptimizationConfig.seed` fixed for reproducibility), used to measure SA's
   optimality gap against MILP and to sanity-check runtime scaling.
3. **Adversarial instance** — deliberately includes an unavailable vehicle, an
   oversubscribed route (more demand than any single vehicle can plausibly cover well),
   and a capacity mismatch, run through `verify_solution()` to confirm rejection with
   correct `details`.

All three should be built and run against synthetic/mock `Vehicle`/`Route` data — no
teammate dependency required for any of this.

---

## 7. Integration checklist

**Buildable and validatable now, against synthetic/mock data (no blockers):**
- `Vehicle`, `Route`, `OptimizationConfig`, `AssignmentResult` dataclasses (§1)
- Cost matrix construction and both solvers (§2–§4)
- Full verification suite + adversarial test (§5)
- All three test fixtures (§6)
- `docs/algorithm.md` (math + solver justification can be written independently of any
  other module)

**Blocked on teammates — needs confirmation before wiring into the real API:**
- Confirmed `Vehicle`/`Route`/`Trip`/`Assignment` schema from whoever owns data
  modeling (currently no `models.py`/`schemas.py` exists at all) — field names, types,
  and units (is `capacity` mass, volume, or passenger count? what units for
  `distance_km`?) must be confirmed, not assumed from the ChargeFlow reference.
  Related: [[data-model-schema]]
- Real fuel-consumption figures/format from Person 1 — specifically whether their
  module outputs a static `fuel_efficiency_km_per_l` per vehicle (current assumption)
  or a per-route-per-vehicle prediction, which would change `_build_cost_matrix` from a
  formula to a lookup (see §2). Related: [[fuel-prediction-integration]]
- A FastAPI route/app (none exists yet) to actually call `compare()` /
  `verify_solution()` / `to_assignment_list()` and return results to the dashboard.
- Confirmation from whoever owns benchmarking/dashboard that both solvers' cost,
  runtime, and optimality gap should be surfaced together (per reference `algorithm.md`
  §5), not just the "winning" result.

---

## 8. `docs/algorithm.md` outline

1. Problem statement — N vehicles, M routes, binary assignment matrix `x_ij`
2. Objective function — full composite cost + each term's formula (§2 above)
3. Quantum-inspired solver: Simulated Annealing — QUBO framing, why SA stands in for a
   quantum annealer, algorithm steps, default schedule
4. Classical baseline: exact MILP — PuLP/CBC formulation, Hungarian fallback
5. Why compare classical vs. quantum-inspired at all — scaling story, optimality gap,
   rehearsal-for-real-quantum-hardware framing
6. Verification suite — table of checks, adversarial test description
7. Interfaces exposed to the rest of the system — the §1 contract, `to_assignment_list`
   hand-off shape
8. Config knobs — `OptimizationConfig` field table with defaults and meaning

---

**Status:** planning only. `backend/app/core/quantum_optimizer.py` and
`docs/algorithm.md` remain empty pending review of this plan.
