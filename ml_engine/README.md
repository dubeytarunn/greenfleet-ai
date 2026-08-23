# GreenFlow AI - Real-Time Driver-Efficiency & Fleet Intelligence Engine

## 1. Overview & Architecture

The **GreenFlow AI ML Engine** provides a dual-layer intelligence platform:
1. **Trip-Level Fleet & Route Optimization Layer (Person 3 Integration):** Predicts trip fuel consumption and $CO_2$ emissions to build the fuel cost matrix for QUBO/Quantum Annealing route allocation.
2. **Real-Time Driver-Efficiency & Behavioral Intelligence Layer (Person 2 ML Engine):** Ingests high-frequency (1Hz) vehicle telemetry streams, compares against LightGBM/GBDT expected fuel baselines, detects 6 driving inefficiency patterns, quantifies fuel waste ($L$, $₹\text{ INR}$, $kg\text{ }CO_2$), and issues debounced coaching alerts.

```
                  ┌────────────────────────────────────────┐
                  │   Vehicle CAN-Bus / IoT Telemetry      │
                  │ (Speed, Accel, RPM, Gear, Load, Slope) │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │       Features Preprocessor & Transformer       │
             │ (Physics Indices, Power Proxy, Slope Work)      │
             └────────┬───────────────────────────────┬────────┘
                      │                               │
                      ▼                               ▼
    ┌───────────────────────────────────┐  ┌───────────────────────────────────┐
    │     LightGBM / GBDT Baseline      │  │    Contextual Behavior Rules      │
    │  - Expected Fuel (L/100km)        │  │  - Excessive Revving              │
    │  - Expected Fuel Rate (L/h)       │  │  - Harsh Acceleration             │
    │  - Expected Efficiency (km/L)     │  │  - Downhill Acceleration          │
    └─────────────────┬─────────────────┘  │  - Inefficient Gear Selection     │
                      │                    │  - Excessive Idling               │
                      │                    └─────────────────┬─────────────────┘
                      ▼                                      ▼
             ┌─────────────────────────────────────────────────┐
             │            Fuel Waste & Impact Estimator        │
             │  - Fuel Deviation % = ((Act - Exp)/Exp) * 100   │
             │  - Excess Fuel Wasted (Litres)                  │
             │  - Economic Cost (₹ INR) & Carbon (kg CO2)      │
             └────────────────────────┬────────────────────────┘
                                      │
                                      ▼
             ┌─────────────────────────────────────────────────┐
             │          Stateful Alert & Coaching Engine       │
             │  - Severity: NORMAL | INFO | WARNING | CRITICAL │
             │  - Debouncing & Escalation                      │
             │  - Range & Refuel Urgency Predictor             │
             └─────────────────────────────────────────────────┘
```

---

## 2. Telemetry Schema & Data Dictionary

The synthetic simulation and production ingest schema consists of 25 standard physics-grounded fields:

| Field Name | Type | Unit / Format | Description |
| :--- | :--- | :--- | :--- |
| `vehicle_id` | `string` | e.g. `"V001"` | Unique fleet asset identifier |
| `timestamp` | `string` | ISO 8601 | UTC observation timestamp |
| `vehicle_type` | `string` | Category | `Van`, `Light Commercial`, `Truck`, `Semi-Trailer`, `Bus` |
| `vehicle_age_years`| `int` | Years | Age of vehicle chassis and engine |
| `engine_size_l` | `float` | Litres | Engine displacement (e.g. 2.0L to 12.8L) |
| `vehicle_weight_kg`| `float` | Kilograms | Total vehicle weight (curb weight + cargo payload) |
| `fuel_type` | `string` | Category | `Diesel`, `Petrol`, `Hybrid`, `CNG`, `Electric` |
| `latitude` | `float` | Degrees | GPS Latitude coordinate |
| `longitude` | `float` | Degrees | GPS Longitude coordinate |
| `speed_kmph` | `float` | km/h | Instantaneous ground speed |
| `acceleration_mps2`| `float` | $\text{m/s}^2$ | Rate of speed change (positive = accel, negative = braking) |
| `rpm` | `float` | RPM | Engine revolutions per minute |
| `gear` | `int` | 0 - 8 | Active transmission gear (0 = Neutral/Park) |
| `throttle_position_pct`| `float` | 0.0 - 100.0% | Accelerator pedal opening percentage |
| `brake_pressure_pct` | `float` | 0.0 - 100.0% | Brake hydraulic pressure applied |
| `engine_load_pct` | `float` | 0.0 - 100.0% | Relative calculated engine load from ECU |
| `road_slope_pct` | `float` | % grade | Road incline/decline grade (negative = downhill) |
| `road_type` | `string` | Category | `Highway`, `Urban`, `Rural`, `Mountain` |
| `traffic_level` | `string` | Category | `Low`, `Medium`, `High`, `Gridlock` |
| `ambient_temperature_c` | `float`| °C | Ambient outside temperature |
| `distance_travelled_km` | `float`| Kilometres | Cumulative trip distance |
| `idle_duration_sec` | `int` | Seconds | Continuous stationary idle duration with engine active |
| `fuel_level_l` | `float` | Litres | Current remaining fuel in vehicle tank |
| `fuel_rate_lph` | `float` | Litres / Hour | Instantaneous fuel flow rate |
| `fuel_consumption_l_100km` | `float`| L / 100km | Instantaneous or distance-integrated fuel rate |

---

## 3. Driving Behavior Detection Scenarios

The engine identifies 6 distinct behaviors without false positives:

1. **Normal Eco-Driving (`normal`):** Smooth throttle progression, optimal gear engagement, fuel rate within $\pm 10\%$ of ML baseline.
2. **Excessive Revving (`excessive_revving`):** RPM $> 2400$ for heavy commercial or $> 3500$ for light vehicles disproportionate to speed.
3. **Harsh Acceleration (`harsh_acceleration`):** Rapid acceleration $\ge 2.5\text{ m/s}^2$ accompanied by $>80\%$ throttle opening.
4. **Downhill Acceleration (`downhill_acceleration`):** Active throttle application while descending negative gradients ($\le -1.8\%$) instead of engine-braking.
5. **Inefficient Gear Selection (`inefficient_gear`):** Engine lugging (high gear at low speed under heavy load) or running low gear at high cruising speed.
6. **Excessive Idling (`excessive_idling`):** Vehicle stationary ($\text{speed} < 1\text{ km/h}$) with engine burning fuel for $>45\text{ seconds}$.

---

## 4. Model Performance & Evaluation

The LightGBM / GBDT telemetry model was trained with temporal/trip isolation:

- **Validation $R^2$ Score:** `0.9991`
- **Test $R^2$ Score:** `0.9990`
- **Test MAE:** `0.18 L / 100km`
- **Test RMSE:** `0.65 L / 100km`
- **Zero Leakage:** No waste, deviation, or cost outputs are present in feature space.

---

## 5. Real-Time Latency Benchmark Profile

Evaluated on 500 stream iterations:
- **Single-Frame Expected Fuel Prediction:** Mean = `17.10 ms`, P95 = `23.40 ms`, Max = `69.58 ms`.
- **End-to-End Alert & Waste Engine (15-Frame Window):** Mean = `14.64 ms`, P95 = `19.43 ms`, Max = `44.04 ms`.
- **Throughput:** Capable of processing over **65 vehicle telemetry windows per second** per single CPU thread.

---

## 6. Migration Guide: Transitioning to Real CAN-Bus / IoT Data

To replace synthetic simulation with real-world telematics:
1. **Connect Telematics Gateway:** Stream vehicle OBD-II / J1939 CAN-bus feeds into standard JSON schema mapping.
2. **Validate Field Mappings:** Ensure standard units ($\text{km/h}$, $\text{m/s}^2$, $\text{RPM}$, $\text{L/h}$).
3. **Re-train Model:** Execute `python ml_engine/training/train_fuel_model.py --data path/to/real_telemetry.csv`.
4. **Deploy Alert Engine:** Call `process_telemetry(window)` inside backend WebSocket / streaming consumer.
