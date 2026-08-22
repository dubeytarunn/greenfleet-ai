# Counterfactual & Explainable Fleet Assignment Engine

## 1. Executive Summary & Philosophy

In enterprise fleet dispatch, black-box optimization algorithms face low operator adoption because dispatchers cannot audit *why* a particular vehicle was selected over another, or *what operational trade-offs* were made.

GreenFlow AI solves this by introducing a **Deterministic, Multi-Factor Explainability and Counterfactual Sensitivity Engine**:
1. **Auditable Decision Decomposition:** Breaks down the selected assignment $(V_i \to R_j)$ across the existing 5-factor suitability scoring model.
2. **Best Feasible Alternative Filtering:** Identifies the strongest legally viable alternative vehicle ($V_{\text{alt}}$) that satisfies capacity and availability constraints.
3. **Multi-Dimensional Delta Analysis:** Quantifies exact deltas for Suitability Score ($\Delta S$), Predicted Fuel ($\Delta F$), Carbon Emissions ($\Delta \text{CO}_2$), and Operating Cost ($\Delta C$).
4. **Carbon Governor & Risk Awareness:** Integrates current shift carbon status (`HEALTHY` / `WARNING` / `CRITICAL`) and conformal uncertainty intervals $[F^{\text{low}}, F^{\text{high}}]$.
5. **True Counterfactual Sensitivity ("What-If?"):** Deterministically computes crossover parameter thresholds (e.g. dynamic carbon penalty $w_{\text{co2}}^*$, traffic congestion factor $\tau^*$, or risk aversion $\lambda^*$) under which the alternative vehicle would become preferred.

> **Zero LLM / Generative Hallucination Guarantee:** All explanations are 100% reproducible, deterministic mathematical derivations grounded in underlying model and optimizer metrics.

---

## 2. Existing 5-Factor Suitability Scoring Reuse

GreenFlow AI preserves and reuses the established 5-factor suitability scoring model in `backend/app/core/scoring.py` ($S \in [0, 100]$):

$$S(V_i, R_j) = 0.30 \cdot S_{\text{capacity}} + 0.25 \cdot S_{\text{fuel}} + 0.15 \cdot S_{\text{distance}} + 0.15 \cdot S_{\text{traffic}} + 0.15 \cdot S_{\text{availability}}$$

### Factor Definitions:
1. **Capacity Match ($S_{\text{capacity}}$):** Evaluates payload utilization $u = \frac{L_j}{C_i}$. Ideal right-sizing ($0.50 \le u \le 0.95$) yields $90\text{--}100\%$, while payload overload is strictly $0\%$.
2. **Fuel Efficiency ($S_{\text{fuel}}$):** Powertrain baseline (Hybrid: 95%, CNG: 85%, Petrol: 75%, Diesel: 70%) adjusted for vehicle age ($-3\text{ pts/year}$) and fuel rate per 100 km.
3. **Distance Suitability ($S_{\text{distance}}$):** Verifies fuel tank reserve margin and matches haul type (heavy trucks for $>100\text{ km}$, light vans for $\le 50\text{ km}$).
4. **Traffic Resilience ($S_{\text{traffic}}$):** Evaluates stop-and-go efficiency under route congestion ($\tau_j > 1.2$).
5. **Availability ($S_{\text{availability}}$):** 100% if available, 0% if under maintenance.

---

## 3. Best Feasible Alternative Selection

For an assigned pair $(V_{\text{target}}, R_{\text{target}})$:
1. Candidate vehicles $V_k \in \mathcal{V} \setminus \{V_{\text{target}}\}$ are evaluated.
2. **Hard Feasibility Constraints:**
   - $V_k.\text{available} == \text{True}$
   - $V_k.\text{max\_payload\_kg} \ge R_{\text{target}}.\text{required\_payload\_kg}$
3. All feasible alternatives are scored via $S(V_k, R_{\text{target}})$ and evaluated under the QUBO cost function:
   $$C(V_k, R_{\text{target}}) = \left( w_{\text{fuel}} \cdot F^{\text{risk}}_{kj} + w_{\text{co2}}(B) \cdot E_{kj} + w_{\text{dist}} \cdot D_j \tau_j + 0.05(C_k - L_j) \right) \cdot \text{priority}_j$$
4. The candidate with the highest suitability score and lowest assignment cost is designated the **Strongest Feasible Alternative** ($V_{\text{alt}}$).
5. If no other vehicle in the fleet has sufficient capacity, the engine flags a **Structural Capacity Constraint** (*"Sole feasible vehicle in the fleet"*).

---

## 4. Factor Decomposition & Delta Calculations

For target $V_{\text{target}}$ and best alternative $V_{\text{alt}}$:

$$\Delta \text{Score} = S(V_{\text{target}}) - S(V_{\text{alt}})$$
$$\Delta \text{Fuel} = \hat{F}(V_{\text{alt}}) - \hat{F}(V_{\text{target}}) \quad (\text{positive} \implies \text{target saves fuel})$$
$$\Delta \text{CO}_2 = E(V_{\text{alt}}) - E(V_{\text{target}}) \quad (\text{positive} \implies \text{target reduces emissions})$$
$$\Delta \text{Cost} = C(V_{\text{alt}}) - C(V_{\text{target}})$$

---

## 5. Counterfactual Sensitivity Analysis ("What-If?")

The engine solves for exact crossover conditions where $V_{\text{alt}}$ overtakes $V_{\text{target}}$:

### A. Carbon Budget Inversion
If $V_{\text{alt}}$ emits less CO₂ ($E_{\text{alt}} < E_{\text{target}}$) but has higher transit/capacity cost:
$$w_{\text{co2}}^* = \frac{C^{\text{non-co2}}_{\text{alt}} - C^{\text{non-co2}}_{\text{target}}}{E_{\text{target}} - E_{\text{alt}}}$$
If $w_{\text{co2}}^* \in [1.0, 5.0]$, the engine computes the exact shift budget utilization $U^* = 70\% + \frac{w^* - 1.0}{4.0} \cdot 30\%$ and states:
> *"V003 (Electric) becomes optimal if Carbon Budget utilisation tightens above 88.5% (dynamic CO2 penalty w_co2 >= 1.85x)."*

### B. Traffic Congestion Inversion
If $V_{\text{alt}}$ has superior traffic resilience (e.g. Hybrid in heavy congestion):
$$\tau^* = \tau_{\text{current}} + \frac{\Delta S}{S^{\text{traffic}}_{\text{alt}} - S^{\text{traffic}}_{\text{target}}} \cdot 0.3$$
> *"V003 would become preferred if route congestion factor escalates above 1.55 due to its superior traffic resilience."*

### C. Risk-Aversion Inversion ($\lambda$)
If $V_{\text{alt}}$ has lower conformal prediction uncertainty ($U_{\text{alt}} < U_{\text{target}}$):
$$\lambda^* = \frac{\hat{F}_{\text{alt}} - \hat{F}_{\text{target}}}{U_{\text{target}} - U_{\text{alt}}}$$
> *"V003 would become preferred if dispatcher risk aversion lambda is increased above 0.85."*

### D. Availability Failover
> *"V003 is the immediate failover assignment if V001 is placed in maintenance or unavailable."*

---

## 6. API Specifications

### Endpoint:
`GET /api/simulate/explanation/{vehicle_id}` or `GET /api/assignments/{vehicle_id}/explanation`

### Response Payload:
```json
{
  "vehicle_id": "V001",
  "route_id": "R001",
  "summary_verdict": "V001 was selected over V002 with a suitability score of 88.4/100 (+14.2 pts), saving 3.5 L fuel and 9.3 kg CO2e.",
  "target": {
    "vehicle_id": "V001",
    "vehicle_type": "Van",
    "fuel_type": "Diesel",
    "predicted_fuel_l": 12.0,
    "estimated_co2_kg": 32.2,
    "overall_suitability_score": 88.4,
    "breakdown": {
      "fuel_efficiency": 85.0,
      "capacity_match": 95.0,
      "distance_suitability": 85.0,
      "traffic_resilience": 88.0,
      "availability": 100.0
    }
  },
  "has_alternative": true,
  "alternative": {
    "vehicle_id": "V002",
    "vehicle_type": "Light Commercial",
    "fuel_type": "Diesel",
    "predicted_fuel_l": 15.5,
    "estimated_co2_kg": 41.5,
    "overall_suitability_score": 74.2,
    "delta_score": 14.2,
    "delta_fuel_l": 3.5,
    "delta_co2_kg": 9.3,
    "delta_cost": 5.8
  },
  "key_advantages": [
    "Superior payload right-sizing (95% vs 70% capacity fit)",
    "Saves 3.5 L predicted fuel per trip",
    "Reduces emissions by 9.3 kg CO2e"
  ],
  "carbon_context": {
    "budget_kg": 1500.0,
    "consumed_kg": 0.0,
    "projected_total_kg": 1043.0,
    "budget_utilisation_pct": 69.5,
    "status": "HEALTHY",
    "dynamic_co2_penalty": 1.0,
    "carbon_pressure_narrative": "Carbon budget is in HEALTHY status (69.5% utilised), allowing balanced optimization across fuel, emissions, and transit cost."
  },
  "counterfactuals": [
    {
      "trigger_type": "availability",
      "description": "V002 is the immediate failover assignment if V001 is marked unavailable or requires maintenance.",
      "parameter_name": "vehicle_availability",
      "current_value": 1.0,
      "threshold_value": 0.0,
      "is_feasible": true
    }
  ],
  "full_narrative": "V001 was selected over V002 with a suitability score of 88.4/100 (+14.2 pts), saving 3.5 L fuel and 9.3 kg CO2e. Key advantages: Superior payload right-sizing (95% vs 70% capacity fit); Saves 3.5 L predicted fuel per trip; Reduces emissions by 9.3 kg CO2e Carbon budget is in HEALTHY status (69.5% utilised), allowing balanced optimization across fuel, emissions, and transit cost."
}
```

---

## 7. Limitations of the PoC

1. **Static Failover Priority:** Real-time driver shift hours and rest break constraints are not currently modeled in the availability score.
2. **Deterministic Vehicle Substitution:** Fleet alternatives assume independent 1-to-1 vehicle substitutions on a single route rather than simultaneous multi-vehicle combinatorial swap chains.
