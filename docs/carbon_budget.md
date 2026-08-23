# GreenFlow AI — Operational Carbon Budget Governor

**Module:** `backend/app/core/carbon_governor.py`  
**API Endpoints:** `/api/simulate/carbon-budget`, `/api/carbon-budget`, `/api/simulate/state`  
**Lead Component:** Person 1 (Tech Lead / Integrator & Carbon Governor)

---

## 1. Executive Summary & Purpose

In conventional fleet management platforms, environmental metrics are treated as **passive reporting metrics** calculated *post-facto* (e.g. "yesterday your fleet produced 4,200 kg of $\text{CO}_2$"). 

GreenFlow AI introduces a **Closed-Loop Operational Carbon Budget Governor**:
1. Fleet dispatchers set a **planning horizon carbon quota** (e.g., $5,000\text{ kg CO}_2$ per shift/window).
2. The Carbon Governor tracks realized (consumed) emissions and projected future emissions from pending route assignments.
3. As the carbon budget is depleted, the Governor calculates a **calibrated dynamic environmental weight** $w_{\text{co2}}(B)$.
4. This dynamic multiplier is injected directly into the **Quantum-Inspired Simulated Annealing cost Hamiltonian**, dynamically tilting assignment preferences toward cleaner, right-sized, and lower-emission vehicles before violations occur.

```
       Operational Carbon Budget Quota (e.g. 5,000 kg)
                           ↓
    Governor Tracks: Consumed + Projected Total Emissions
                           ↓
             Budget Utilisation Ratio (u = E_proj / Budget)
                           ↓
            Governor State: HEALTHY / WARNING / CRITICAL / OVER_BUDGET
                           ↓
        Dynamic Environmental Multiplier: w_co2(B)
                           ↓
    Optimizer Objective: c_ij = (w_f · F_ij + w_co2(B) · E_ij + w_d · D_j · τ_j + pen_cap) · p_j
                           ↓
  Quantum-Inspired SA Finds Optimal Carbon-Governed Fleet Assignment
```

---

## 2. Terminology & Accounting Distinction

To ensure auditability, GreenFlow strictly distinguishes between realized and future projected emissions:

| Term | Symbol | Definition | Calculation |
|---|---|---|---|
| **Carbon Budget** | $B$ | Total allocated carbon quota for the planning window (kg $\text{CO}_2$). | Configurable ($5,000\text{ kg}$ default) |
| **Consumed Emissions** | $E_{\text{consumed}}$ | Realised emissions from completed or dispatched trips. | $\sum_{a \in \text{completed}} \text{CO}_{2,a}$ |
| **Projected Emissions** | $E_{\text{projected}}$ | Expected future emissions from active or planned route assignments. | $\sum_{a \in \text{assigned}} \text{CO}_{2,a}$ |
| **Projected Total** | $E_{\text{total}}$ | Total expected carbon footprint across the full planning window. | $E_{\text{consumed}} + E_{\text{projected}}$ |
| **Remaining Budget** | $B_{\text{rem}}$ | Net carbon quota remaining (can be negative if over budget). | $B - E_{\text{total}}$ |
| **Budget Headroom** | $B_{\text{headroom}}$ | Non-negative margin before exceeding quota. | $\max(0, B - E_{\text{total}})$ |
| **Budget Utilisation** | $u$ | Percentage of carbon budget consumed or committed. | $\left(\frac{E_{\text{total}}}{B}\right) \times 100\%$ |
| **$\text{CO}_2$ Avoided** | $\Delta \text{CO}_2$ | Carbon saved compared to uncoordinated greedy baseline. | $\max(0, E_{\text{baseline}} - E_{\text{total}})$ |

---

## 3. Operational Demonstration Thresholds & Statuses

The Governor classifies the fleet state into four operational demonstration regimes:

```
0% ──────────── 70% ──────────────────── 90% ────────────── 100% ───────────────> % Utilisation
   HEALTHY           WARNING                 CRITICAL             OVER_BUDGET
(w_co2 = 1.0)     (w_co2: 1.0 → 1.8)      (w_co2: 1.8 → 3.0)   (w_co2: 3.0 → 5.0)
```

1. **`HEALTHY` ($u \le 70\%$):**
   - **Operational Meaning:** Safe headroom; operating well within carbon allowances.
   - **Penalty Multiplier:** $w_{\text{co2}} = 1.0$.
   - **Optimization Impact:** Standard balanced trade-off between fuel efficiency, distance, payload right-sizing, and priority.

2. **`WARNING` ($70\% < u \le 90\%$):**
   - **Operational Meaning:** Approaching quota limits; carbon consumption is accelerating.
   - **Penalty Multiplier:** $w_{\text{co2}} \in [1.0, 1.8]$ via linear interpolation:
     $$w_{\text{co2}} = 1.0 + 0.8 \cdot \left(\frac{u - 0.70}{0.20}\right)$$
   - **Optimization Impact:** Moderate carbon pressure; borderline vehicle choices shift toward lower-emission powertrains.

3. **`CRITICAL` ($90\% < u \le 100\%$):**
   - **Operational Meaning:** Immediate risk of budget exhaustion.
   - **Penalty Multiplier:** $w_{\text{co2}} \in [1.8, 3.0]$ via linear interpolation:
     $$w_{\text{co2}} = 1.8 + 1.2 \cdot \left(\frac{u - 0.90}{0.10}\right)$$
   - **Optimization Impact:** Strong carbon prioritization; emissions dominate over small distance or priority conveniences.

4. **`OVER_BUDGET` ($u > 100\%$):**
   - **Operational Meaning:** Fleet emissions exceed the assigned carbon cap.
   - **Penalty Multiplier:** $w_{\text{co2}} \in [3.0, 5.0]$ via:
     $$w_{\text{co2}} = 3.0 + \min\left(2.0, (u - 1.0) \times 4.0\right)$$
   - **Optimization Impact:** Dominant carbon minimization where operationally feasible, strictly suppressing high-emission diesel dispatches in favor of CNG, hybrid, and electric units.

> [!NOTE]
> *Operational Threshold Context:* These thresholds are calibrated operational demonstration parameters designed for GreenFlow's decision engine and can be adjusted per enterprise sustainability policy.

---

## 4. Optimization Coupling & Mathematical Formulation

The dynamic penalty $w_{\text{co2}}(B)$ directly modulates the vehicle-route assignment cost matrix $c_{i,j}$:

$$c_{i,j} = \left( w_{\text{fuel}} \cdot F_{i,j} + w_{\text{co2}}(B) \cdot E_{i,j} + w_{\text{dist}} \cdot D_j \cdot \tau_j + \text{pen}_{\text{cap}}(i,j) \right) \cdot \text{priority}_j$$

Where:
- $F_{i,j}$: Predicted fuel consumption in litres (from LightGBM ML inference).
- $E_{i,j}$: Estimated $\text{CO}_2$ emissions in kg ($F_{i,j} \times \text{Factor}_{\text{fuel}}$).
- $D_j, \tau_j$: Route distance (km) and traffic factor ($1.0 - 2.0$).
- $\text{pen}_{\text{cap}}(i,j)$: Payload right-sizing penalty ($0.05 \cdot (M_i - R_j)$ for surplus; $10^8 + 5000 \cdot (R_j - M_i)$ for shortfall).

### Calibration Against Numerical Ranges:
- Typical fuel cost: $F_{i,j} \cdot w_{\text{fuel}} \approx 15.0 - 35.0$.
- Typical emissions: $E_{i,j} \approx 20.0 - 60.0\text{ kg}$.
- When $w_{\text{co2}} = 1.0$, emissions contribute $20 - 60$ to the cell cost.
- Under `OVER_BUDGET` ($w_{\text{co2}} = 4.0$), emissions contribute $80 - 240$, actively overriding moderate fuel/capacity preferences while remaining well below hard constraint penalties ($10^8$).

---

## 5. Standard Emission Factors

Emission conversion factors are sourced from **UK Government GHG / DEFRA** and **US EPA Fleet Standards**:

| Fuel / Powertrain Type | Emission Factor ($\text{kg CO}_2\text{ / L or kWh}$) | Source Standard |
|---|---|---|
| **Diesel** | $2.68\text{ kg CO}_2\text{/L}$ | DEFRA Conversion Standard |
| **Petrol** | $2.31\text{ kg CO}_2\text{/L}$ | DEFRA Conversion Standard |
| **Hybrid (Petrol/Electric)** | $2.31\text{ kg CO}_2\text{/L}$ (adjusted by 25% powertrain efficiency) | DEFRA Standard |
| **Compressed Natural Gas (CNG)**| $1.95\text{ kg CO}_2\text{/kg}$ | US EPA Commercial Fleet |
| **Electric (EV)** | $0.45\text{ kg CO}_2\text{/kWh}$ | Regional Grid Average Factor |

---

## 6. Simulation & REST API Integration

- **`GET /api/simulate/carbon-budget`**: Returns active `CarbonBudgetState` model.
- **`POST /api/simulate/carbon-budget`**: Dynamically adjusts planning budget quota.
- **`POST /api/simulate/reset`**: Re-initializes carbon budget to $5,000\text{ kg}$, status `HEALTHY`.
- **`POST /api/simulate/peak`**: Injects $+25\%$ demand surge, increasing projected emissions and elevating $w_{\text{co2}}$.
- **`POST /api/simulate/optimize`**: Executes quantum-inspired simulated annealing with governor-supplied dynamic carbon weight.
