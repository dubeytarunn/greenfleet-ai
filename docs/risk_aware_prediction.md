# Risk-Aware Fuel Consumption Prediction & Conformal Uncertainty

## 1. Executive Summary & Problem Motivation

Standard fleet dispatch algorithms rely on deterministic point estimates of fuel consumption ($\hat{F}_{ij}$). In real-world urban logistics, deterministic predictions fail because:
1. **Traffic Volatility:** Congestion introduces high variance in stop-and-go energy loss.
2. **Payload Stress:** Near-capacity loads increase engine strain variance across varying road gradients.
3. **Vehicle Wear & Aging:** Mechanical deterioration widens the distribution of actual consumption.
4. **Deterministic Optimization Bias:** Optimizers choosing routes purely on point estimates $\hat{F}_{ij}$ frequently assign high-variance, fragile vehicles to critical routes, leading to budget overruns and operational failures.

GreenFlow AI solves this by introducing **Risk-Aware Fuel Prediction** via **Locally-Adaptive Split Conformal Prediction** directly coupled into the **QUBO Cost Hamiltonian**.

---

## 2. Uncertainty Estimation Methodology

### A. Method Selection: Locally-Adaptive Split Conformal Prediction
GreenFlow AI implements **Split Conformal Prediction** calibrated on held-out residual distributions from fleet operations, scaled by an operational **Dispersion Function** $S(x)$.

Unlike uncalibrated heuristics or raw quantiles, Conformal Prediction provides a **finite-sample coverage guarantee**:
$$\mathbb{P}\left(y \in [\hat{F}_{\text{low}}, \hat{F}_{\text{high}}]\right) \ge 1 - \alpha$$
Where $1 - \alpha = 0.90$ (90% confidence interval).

### B. Heteroscedastic Dispersion Function $S(x)$
The dispersion function captures operational risk factors per vehicle $i$ and route $j$:
$$S(x_{ij}) = 1.0 + 0.35 \cdot (\tau_j - 1.0) + 0.25 \cdot \left(\frac{L_j}{\max(C_i, 1.0)}\right) + 0.04 \cdot A_i + 0.15 \cdot (W_j - 1.0) + 0.05 \cdot |G_j|$$

Where:
- $\tau_j$: Traffic Congestion Multiplier ($\tau_j \ge 1.0$)
- $L_j$: Route Required Payload (kg)
- $C_i$: Vehicle Maximum Carrying Capacity (kg)
- $A_i$: Vehicle Age (years)
- $W_j$: Weather Stress Index
- $G_j$: Road Incline Grade

### C. Conformal Non-Conformity Calibration & Empirical Validation
On the calibration dataset, non-conformity scores are computed:
$$R_k = \frac{|y_k - \hat{y}_k|}{S(x_k)}$$
The empirical $90\text{th}$ percentile conformal quantile is:
$$\hat{q}_{0.90} = 1.805\text{ L} \quad (\hat{q}_{0.95} = 2.546\text{ L})$$

#### Empirical Verification on 1,200 Held-Out Fleet Trips:
- **Nominal 90% Confidence Interval $\to$ Observed Empirical Coverage:** **`90.25%`**
- **Nominal 95% Confidence Interval $\to$ Observed Empirical Coverage:** **`95.50%`**
- **Median 90% Interval Width ($2U$):** **`6.13 L`** (Half-width $U = 3.07\text{ L}$)
- **Mean 90% Interval Width ($2U$):** **`6.11 L`**

---

## 3. Prediction Intervals & Uncertainty Definition

For any candidate assignment of vehicle $i$ to route $j$:

1. **Expected Fuel Point Prediction ($\hat{F}_{ij}$):**
   $$\hat{F}_{ij} = \text{LightGBM}(x_{ij})$$

2. **Uncertainty Half-Width ($U_{ij}$):**
   $$U_{ij} = \hat{q}_{1-\alpha} \cdot S(x_{ij})$$

3. **Calibrated Prediction Interval:**
   $$\hat{F}^{\text{low}}_{ij} = \max\left(0.1, \hat{F}_{ij} - U_{ij}\right)$$
   $$\hat{F}^{\text{high}}_{ij} = \hat{F}_{ij} + U_{ij}$$

4. **Relative Uncertainty Percentage:**
   $$\text{UncertaintyPct}_{ij} = \left(\frac{U_{ij}}{\hat{F}_{ij}}\right) \times 100\%$$

---

## 4. Risk-Adjusted Fuel Consumption

To incorporate risk tolerance into fleet dispatch, GreenFlow defines **Risk-Adjusted Fuel Consumption**:

$$F^{\text{risk}}_{ij} = \hat{F}_{ij} + \lambda \cdot U_{ij} = \hat{F}_{ij} + \lambda \cdot \left(\hat{F}^{\text{high}}_{ij} - \hat{F}_{ij}\right)$$

Where $\lambda \ge 0$ is the **Dispatcher Risk-Aversion Parameter**:
- $\lambda = 0.0$: **Risk-Neutral** (Optimizes purely for expected fuel $\hat{F}_{ij}$)
- $0 < \lambda \le 0.5$: **Mild Risk Aversion** (**Default: $\lambda = 0.5$**, balanced variance protection)
- $0.5 < \lambda \le 1.0$: **Moderate Risk Aversion**
- $\lambda > 1.0$: **High Risk Aversion** (Heavily penalizes volatile vehicle-route combinations)

---

## 5. Integration into QUBO / SA Optimization

Risk-adjusted fuel replaces raw expected fuel *only* in the fuel risk penalty term of the objective cost matrix $C_{ij}$:

$$C_{ij} = \left( w_{\text{fuel}} \cdot F^{\text{risk}}_{ij} + w_{\text{co2}}(B) \cdot E_{ij} + w_{\text{dist}} \cdot D_j \cdot \tau_j + \text{pen}_{\text{cap}}(i, j) \right) \cdot \text{priority}_j$$

Where:
- $F^{\text{risk}}_{ij} = \hat{F}_{ij} + \lambda \cdot U_{ij}$: Fuel consumption risk surrogate.
- $E_{ij} = \hat{F}_{ij} \cdot \text{Factor}_{\text{fuel}}$: **Expected physical CO₂ emissions** computed from expected fuel consumption $\hat{F}_{ij}$ (independent of optimization risk surrogate $F^{\text{risk}}_{ij}$).
- $w_{\text{co2}}(B) \in [1.0, 5.0]$: Dynamic environmental penalty computed independently by the **Carbon Budget Governor**.

### Dual-Adaptive Optimization:
1. **Risk Dimension ($\lambda$):** Steers assignments away from high-uncertainty options.
2. **Carbon Dimension ($B_{\text{shift}}$):** Escalates physical emissions penalties as the cumulative budget tightens.


---

## 6. Empirical Controlled Trade-Off Test

In unit test `test_10_controlled_risk_trade_off_decision_flip`, we verify the optimizer's response:

| Vehicle | Expected Fuel ($\hat{F}$) | Uncertainty ($U$) | Upper Bound ($F^{\text{high}}$) | $F^{\text{risk}}(\lambda=0.0)$ | $F^{\text{risk}}(\lambda=1.0)$ | Preference ($\lambda=0.0$) | Preference ($\lambda=1.0$) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Vehicle A (Older Truck)** | **18.0 L** | **8.0 L** | **26.0 L** | **18.0 L** | 26.0 L | **SELECTED** | Rejected |
| **Vehicle B (Newer Truck)** | 20.0 L | **1.0 L** | **21.0 L** | 20.0 L | **21.0 L** | Rejected | **SELECTED** |

**Conclusion:** When risk aversion is enabled ($\lambda = 1.0$), GreenFlow AI automatically rejects the fragile Vehicle A in favor of Vehicle B, avoiding potential operational variance.

---

## 7. Limitations of the PoC

1. **Traffic Heterogeneity:** Real-time GPS congestion speed profiles are simulated via scenario multipliers ($\tau_j \in [1.0, 1.6]$).
2. **Cold Start:** Vehicles without maintenance history rely on type-level prior distributions.
