import requests
import json

BASE = "http://127.0.0.1:8000"

def run_authoritative_demo_audit():
    print("=" * 80)
    print("GREENFLOW AI — AUTHORITATIVE RUNTIME DEMO AUDIT")
    print("=" * 80)

    # 1. RESET
    requests.post(f"{BASE}/api/simulate/reset")

    # 2. NORMAL
    r_norm = requests.get(f"{BASE}/api/simulate/state").json()
    cb_norm = r_norm["carbon_budget"]
    print(f"[STAGE 1: RESET & NORMAL]")
    print(f"  Routes: {r_norm['routes_count']} | Vehicles: {r_norm['vehicles_count']}")
    print(f"  Projected CO2: {cb_norm['projected_total_kg']} kg | Budget: {cb_norm['budget_kg']} kg")
    print(f"  Utilisation: {cb_norm['budget_utilisation_pct']}% | Status: {cb_norm['status']} | Penalty: {cb_norm['dynamic_co2_penalty']}x")

    # 3. PEAK DEMAND
    r_peak = requests.post(f"{BASE}/api/simulate/peak").json()
    cb_peak = r_peak["carbon_budget"]
    print(f"\n[STAGE 2: PEAK DEMAND ANOMALY]")
    print(f"  Routes: {r_peak['routes_count']} | Vehicles: {r_peak['vehicles_count']}")
    print(f"  Projected CO2: {cb_peak['projected_total_kg']} kg | Budget: {cb_peak['budget_kg']} kg")
    print(f"  Utilisation: {cb_peak['budget_utilisation_pct']}% | Status: {cb_peak['status']} | Penalty: {cb_peak['dynamic_co2_penalty']}x")

    # 4. RUN OPTIMIZATION
    r_opt = requests.post(f"{BASE}/api/simulate/optimize").json()
    bm = r_opt["benchmark"]
    cb_opt = r_opt["carbon_budget"]
    print(f"\n[STAGE 3: RUN OPTIMIZATION]")
    print(f"  Baseline Fuel: {bm['baseline']['total_fuel_l']} L | Optimized Fuel: {bm['greenflow']['total_fuel_l']} L")
    print(f"  Fuel Saved: {bm['fuel_saved_l']} L ({bm['fuel_saved_pct']}%)")
    print(f"  Baseline CO2: {bm['baseline']['estimated_co2_kg']} kg | Optimized CO2: {bm['greenflow']['estimated_co2_kg']} kg")
    print(f"  CO2 Reduced: {bm['co2_reduced_kg']} kg ({bm['co2_reduced_pct']}%)")
    print(f"  Realized CO2: {cb_opt['projected_total_kg']} kg | Budget: {cb_opt['budget_kg']} kg")
    print(f"  Utilisation: {cb_opt['budget_utilisation_pct']}% | Status: {cb_opt['status']} | Penalty: {cb_opt['dynamic_co2_penalty']}x")

    # 5. ECONOMICS
    r_eco = requests.get(f"{BASE}/api/simulate/economics").json()
    print(f"\n[STAGE 4: COMMERCIAL ECONOMICS & DIFFERENTIATED ROI]")
    print(f"  Baseline Fuel Spend: INR {r_eco['baseline_fuel_cost']:,.2f}")
    print(f"  Optimized Fuel Spend: INR {r_eco['greenflow_fuel_cost']:,.2f}")
    print(f"  Direct Cash Saved: INR {r_eco['direct_fuel_cost_saved']:,.2f} ({r_eco['fuel_saved_pct']}%)")
    print(f"  Avoided Carbon Shadow Value (@ INR 2,500/t): INR {r_eco['avoided_carbon_shadow_value']:,.2f}")
    print(f"  Combined Economic Impact: INR {r_eco['combined_economic_impact']:,.2f}")

    # 6. WHY DRAWER (V001 on R001)
    r_why = requests.get(f"{BASE}/api/assignments/V001/explanation").json()
    tgt = r_why["target"]
    risk = r_why["risk_context"]
    print(f"\n[STAGE 5: EXPLAINABILITY & CONFORMAL RISK (V001 on R001)]")
    print(f"  Vehicle: {tgt['vehicle_id']} ({tgt['vehicle_type']}, {tgt['fuel_type']}) | Route: {tgt['route_id']} ({tgt['distance_km']} km)")
    print(f"  Expected Fuel (ML Point Estimate): {tgt['predicted_fuel_l']} L")
    print(f"  90% Conformal Prediction Interval: [{tgt['fuel_lower_l']} L – {tgt['fuel_upper_l']} L]")
    print(f"  Risk Aversion Lambda: {risk['risk_aversion_lambda']}")
    print(f"  Risk-Adjusted Fuel (QUBO Cost): {tgt['risk_adjusted_fuel_l']} L")
    print(f"  Direct CO2 (Physical): {tgt['estimated_co2_kg']} kg")
    print(f"  Suitability Score: {tgt['overall_suitability_score']}/100")

    # 7. LIVE TELEMETRY (NORMAL & HARSH EVENT)
    r_tel_norm = requests.post(f"{BASE}/api/predict/telemetry", json={"window": [{
        "vehicle_id": "V001", "vehicle_type": "Truck", "fuel_type": "Diesel",
        "speed_kmph": 50.0, "acceleration_mps2": 0.3, "rpm": 1650.0, "gear": 4,
        "throttle_position_pct": 35.0, "brake_pressure_pct": 5.0, "engine_load_pct": 45.0,
        "fuel_level_l": 48.0, "idle_duration_sec": 0
    }]}).json()
    r_tel_harsh = requests.post(f"{BASE}/api/predict/telemetry", json={"window": [{
        "vehicle_id": "V001", "vehicle_type": "Truck", "fuel_type": "Diesel",
        "speed_kmph": 72.0, "acceleration_mps2": 3.6, "rpm": 3900.0, "gear": 2,
        "throttle_position_pct": 92.0, "brake_pressure_pct": 80.0, "engine_load_pct": 96.0,
        "fuel_level_l": 44.0, "idle_duration_sec": 25
    }]}).json()

    print(f"\n[STAGE 6: MODEL 2 CONTINUOUS TELEMETRY]")
    print(f"  Normal Cruising: Score={r_tel_norm['behaviour_score']} | Behaviour={r_tel_norm['behaviour']} | Severity={r_tel_norm['severity']} | Range={r_tel_norm['remaining_range_km']} km")
    print(f"  Harsh Driving:   Score={r_tel_harsh['behaviour_score']} | Behaviour={r_tel_harsh['behaviour']} | Severity={r_tel_harsh['severity']} | Alert={r_tel_harsh['message']}")

    print("=" * 80)
    print("ALL DEMO VALUES AUDITED & EXTRACTED DIRECTLY FROM LIVE BACKEND RUNTIME")
    print("=" * 80)

if __name__ == "__main__":
    run_authoritative_demo_audit()
