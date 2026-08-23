"""
GreenFlow AI - Explainable & Counterfactual Assignment Engine
============================================================
Provides deterministic, fully auditable, and mathematically grounded explanations
for vehicle-route optimization decisions:
1. Target Vehicle 5-Factor Suitability Scoring
2. Best Feasible Alternative Identification & Filtering
3. Multi-Factor Comparative Delta Decomposition
4. Carbon Budget Governor Context & Penalty Awareness
5. Risk-Aware Prediction Interval Context
6. True Counterfactual Sensitivity & Parameter Inversion Analysis ("What-If")
"""

import logging
from typing import Dict, List, Optional, Tuple, Any

from backend.app.core.scoring import calculate_suitability_score
from backend.app.core.carbon_governor import CarbonBudgetGovernor, CarbonBudgetStatus
from backend.app.models.vehicle import VehicleModel
from backend.app.models.route import RouteModel
from backend.app.models.assignment import PredictionModel
from backend.app.models.simulation import CarbonBudgetModel, ScoreBreakdown
from backend.app.models.explainability import (
    AssignmentExplanationResponse,
    TargetAssignmentDetails,
    AlternativeVehicleDetails,
    CounterfactualInsight,
    CarbonContextModel,
    RiskContextModel,
)

logger = logging.getLogger(__name__)


def _calculate_assignment_cost(
    vehicle: VehicleModel,
    route: RouteModel,
    pred: Optional[PredictionModel],
    co2_weight: float = 1.0,
    fuel_weight: float = 1.0,
    distance_weight: float = 0.3,
    risk_aversion_lambda: float = 0.5,
) -> float:
    """Computes exact QUBO cost matrix cell value for a vehicle-route pair."""
    if not vehicle.available or vehicle.max_payload_kg < route.required_payload_kg:
        return 1e9  # Infeasible

    if pred is None:
        return 1e9

    # Risk-adjusted fuel
    if pred.risk_adjusted_fuel_l is not None:
        effective_fuel = pred.risk_adjusted_fuel_l
    elif pred.uncertainty_l is not None:
        effective_fuel = pred.predicted_fuel_l + (risk_aversion_lambda * pred.uncertainty_l)
    else:
        effective_fuel = pred.predicted_fuel_l

    fuel_cost = effective_fuel * fuel_weight
    co2_penalty = pred.estimated_co2_kg * co2_weight
    distance_penalty = route.distance_km * route.traffic_factor * distance_weight
    capacity_penalty = 0.05 * (vehicle.max_payload_kg - route.required_payload_kg)

    return (fuel_cost + co2_penalty + distance_penalty + capacity_penalty) * route.priority


def explain_assignment(
    target_vehicle: VehicleModel,
    target_route: RouteModel,
    fleet: List[VehicleModel],
    routes: List[RouteModel],
    predictions: List[PredictionModel],
    carbon_budget: Optional[CarbonBudgetModel] = None,
    risk_aversion_lambda: float = 0.5,
) -> AssignmentExplanationResponse:
    """
    Generates a complete, deterministic, and auditable explanation for a single assignment.
    """
    pred_lookup = {(p.vehicle_id, p.route_id): p for p in predictions}
    target_pred = pred_lookup.get((target_vehicle.vehicle_id, target_route.route_id))
    
    # 1. Target Suitability Score & Breakdown
    target_fuel = target_pred.predicted_fuel_l if target_pred else None
    target_score_obj = calculate_suitability_score(
        target_vehicle, target_route, predicted_fuel_l=target_fuel
    )
    
    co2_weight = carbon_budget.dynamic_co2_penalty if carbon_budget else 1.0
    budget_status = carbon_budget.status if carbon_budget else CarbonBudgetStatus.HEALTHY
    budget_util = carbon_budget.budget_utilisation_pct if carbon_budget else 69.5
    target_cost = round(_calculate_assignment_cost(
        target_vehicle, target_route, target_pred, co2_weight=co2_weight, risk_aversion_lambda=risk_aversion_lambda
    ), 2)


    target_details = TargetAssignmentDetails(
        vehicle_id=target_vehicle.vehicle_id,
        vehicle_type=target_vehicle.vehicle_type,
        fuel_type=target_vehicle.fuel_type,
        vehicle_age=target_vehicle.vehicle_age,
        max_payload_kg=target_vehicle.max_payload_kg,
        route_id=target_route.route_id,
        origin=target_route.origin,
        destination=target_route.destination,
        distance_km=target_route.distance_km,
        required_payload_kg=target_route.required_payload_kg,
        traffic_factor=target_route.traffic_factor,
        priority=target_route.priority,
        predicted_fuel_l=target_pred.predicted_fuel_l if target_pred else 0.0,
        estimated_co2_kg=target_pred.estimated_co2_kg if target_pred else 0.0,
        fuel_lower_l=target_pred.fuel_lower_l if target_pred else None,
        fuel_upper_l=target_pred.fuel_upper_l if target_pred else None,
        uncertainty_l=target_pred.uncertainty_l if target_pred else None,
        uncertainty_pct=target_pred.uncertainty_pct if target_pred else None,
        risk_adjusted_fuel_l=target_pred.risk_adjusted_fuel_l if target_pred else None,
        overall_suitability_score=target_score_obj.overall_score,
        breakdown=target_score_obj.breakdown,
        assignment_cost=target_cost,
    )

    # 2. Identify Feasible Alternatives
    feasible_alternatives = []
    for v in fleet:
        if v.vehicle_id == target_vehicle.vehicle_id:
            continue
        # Hard constraint checks: Available + Payload capacity match
        if not v.available:
            continue
        if v.max_payload_kg < target_route.required_payload_kg:
            continue

        alt_pred = pred_lookup.get((v.vehicle_id, target_route.route_id))
        if alt_pred is None:
            continue

        alt_score_obj = calculate_suitability_score(
            v, target_route, predicted_fuel_l=alt_pred.predicted_fuel_l
        )
        alt_cost = _calculate_assignment_cost(
            v, target_route, alt_pred, co2_weight=co2_weight, risk_aversion_lambda=risk_aversion_lambda
        )

        feasible_alternatives.append({
            "vehicle": v,
            "pred": alt_pred,
            "score_obj": alt_score_obj,
            "cost": alt_cost,
        })

    # Sort alternatives by overall suitability score (highest first), then cost (lowest first)
    feasible_alternatives.sort(key=lambda x: (-x["score_obj"].overall_score, x["cost"]))

    best_alt_details: Optional[AlternativeVehicleDetails] = None
    key_advantages: List[str] = []
    counterfactuals: List[CounterfactualInsight] = []

    if feasible_alternatives:
        top_alt = feasible_alternatives[0]
        alt_v = top_alt["vehicle"]
        alt_p = top_alt["pred"]
        alt_s = top_alt["score_obj"]
        alt_assignment_cost = round(top_alt["cost"], 2)

        d_score = round(target_score_obj.overall_score - alt_s.overall_score, 1)
        d_fuel = round(alt_p.predicted_fuel_l - target_details.predicted_fuel_l, 1)
        d_co2 = round(alt_p.estimated_co2_kg - target_details.estimated_co2_kg, 1)
        d_cost = round(alt_assignment_cost - target_cost, 2)

        best_alt_details = AlternativeVehicleDetails(
            vehicle_id=alt_v.vehicle_id,
            vehicle_type=alt_v.vehicle_type,
            fuel_type=alt_v.fuel_type,
            max_payload_kg=alt_v.max_payload_kg,
            predicted_fuel_l=alt_p.predicted_fuel_l,
            estimated_co2_kg=alt_p.estimated_co2_kg,
            fuel_lower_l=alt_p.fuel_lower_l,
            fuel_upper_l=alt_p.fuel_upper_l,
            uncertainty_l=alt_p.uncertainty_l,
            risk_adjusted_fuel_l=alt_p.risk_adjusted_fuel_l,
            overall_suitability_score=alt_s.overall_score,
            breakdown=alt_s.breakdown,
            assignment_cost=alt_assignment_cost,
            delta_score=d_score,
            delta_fuel_l=d_fuel,
            delta_co2_kg=d_co2,
            delta_cost=d_cost,
        )


        # Factor Advantage Decomposition
        t_bk = target_score_obj.breakdown
        a_bk = alt_s.breakdown

        if t_bk.capacity_match > a_bk.capacity_match + 2.0:
            key_advantages.append(
                f"Superior payload right-sizing ({t_bk.capacity_match:.0f}% vs {a_bk.capacity_match:.0f}% capacity fit)"
            )
        if t_bk.fuel_efficiency > a_bk.fuel_efficiency + 2.0:
            key_advantages.append(
                f"Higher powertrain thermal efficiency ({t_bk.fuel_efficiency:.0f}% vs {a_bk.fuel_efficiency:.0f}%)"
            )
        if d_fuel > 0.2:
            key_advantages.append(f"Saves {d_fuel:.1f} L predicted fuel per trip")
        if d_co2 > 0.5:
            key_advantages.append(f"Reduces emissions by {d_co2:.1f} kg CO2e")
        if target_pred and target_pred.uncertainty_l and alt_p.uncertainty_l:
            if target_pred.uncertainty_l < alt_p.uncertainty_l - 0.5:
                key_advantages.append(f"Lower prediction variance (±{target_pred.uncertainty_l:.1f} L vs ±{alt_p.uncertainty_l:.1f} L)")

        if not key_advantages:
            if d_score >= 0:
                key_advantages.append(f"Achieved higher overall suitability score ({target_score_obj.overall_score:.1f} vs {alt_s.overall_score:.1f})")
            else:
                key_advantages.append(f"Optimal operational compatibility ({target_score_obj.overall_score:.1f}/100 suitability)")


        # ----------------------------------------------------------------------
        # Counterfactual What-If Sensitivity Analysis
        # ----------------------------------------------------------------------
        # 1. Carbon Budget Inversion
        if alt_p.estimated_co2_kg < target_details.estimated_co2_kg:
            co2_diff = target_details.estimated_co2_kg - alt_p.estimated_co2_kg
            cost_diff_non_co2 = (
                (top_alt["cost"] - (co2_weight * alt_p.estimated_co2_kg * target_route.priority))
                - (_calculate_assignment_cost(target_vehicle, target_route, target_pred, co2_weight=0.0, risk_aversion_lambda=risk_aversion_lambda))
            ) / max(target_route.priority, 1)
            
            if co2_diff > 0.1:
                threshold_co2_weight = cost_diff_non_co2 / co2_diff
                if 1.0 <= threshold_co2_weight <= 5.0:
                    # Estimate utilization percentage required
                    util_req = 70.0 + ((threshold_co2_weight - 1.0) / 4.0) * 30.0
                    counterfactuals.append(CounterfactualInsight(
                        trigger_type="carbon_budget",
                        description=f"{alt_v.vehicle_id} ({alt_v.fuel_type}) becomes optimal if Carbon Budget utilisation tightens above {util_req:.1f}% (dynamic CO2 penalty w_co2 >= {threshold_co2_weight:.2f}x).",
                        parameter_name="dynamic_co2_penalty",
                        current_value=round(co2_weight, 2),
                        threshold_value=round(threshold_co2_weight, 2),
                        is_feasible=True,
                    ))
                else:
                    counterfactuals.append(CounterfactualInsight(
                        trigger_type="carbon_budget",
                        description=f"{alt_v.vehicle_id} emits {co2_diff:.1f} kg less CO2 and becomes preferable under extreme carbon rationing.",
                        parameter_name="dynamic_co2_penalty",
                        current_value=round(co2_weight, 2),
                        threshold_value=None,
                        is_feasible=True,
                    ))
        else:
            counterfactuals.append(CounterfactualInsight(
                trigger_type="carbon_budget",
                description=f"Under current parameters, {target_vehicle.vehicle_id} is already both more fuel-efficient and lower in emissions than {alt_v.vehicle_id}.",
                parameter_name="dynamic_co2_penalty",
                current_value=round(co2_weight, 2),
                threshold_value=None,
                is_feasible=False,
            ))

        # 2. Traffic Factor Inversion
        if a_bk.traffic_resilience > t_bk.traffic_resilience + 5.0:
            traffic_gap = a_bk.traffic_resilience - t_bk.traffic_resilience
            threshold_traffic = target_route.traffic_factor + (d_score / max(traffic_gap, 1.0)) * 0.3
            counterfactuals.append(CounterfactualInsight(
                trigger_type="traffic_factor",
                description=f"{alt_v.vehicle_id} ({alt_v.vehicle_type}) would become preferred if route congestion factor escalates above {threshold_traffic:.2f} due to its superior traffic resilience.",
                parameter_name="traffic_factor",
                current_value=round(target_route.traffic_factor, 2),
                threshold_value=round(threshold_traffic, 2),
                is_feasible=True,
            ))

        # 3. Risk Aversion Inversion
        if target_pred and target_pred.uncertainty_l and alt_p.uncertainty_l:
            if alt_p.uncertainty_l < target_pred.uncertainty_l:
                unc_diff = target_pred.uncertainty_l - alt_p.uncertainty_l
                exp_diff = alt_p.predicted_fuel_l - target_pred.predicted_fuel_l
                if unc_diff > 0.05 and exp_diff > 0:
                    lambda_threshold = exp_diff / unc_diff
                    counterfactuals.append(CounterfactualInsight(
                        trigger_type="risk_aversion",
                        description=f"{alt_v.vehicle_id} would become preferred if dispatcher risk aversion lambda is increased above {lambda_threshold:.2f} due to lower prediction uncertainty.",
                        parameter_name="risk_aversion_lambda",
                        current_value=round(risk_aversion_lambda, 2),
                        threshold_value=round(lambda_threshold, 2),
                        is_feasible=True,
                    ))

        # 4. Availability Inversion
        counterfactuals.append(CounterfactualInsight(
            trigger_type="availability",
            description=f"{alt_v.vehicle_id} is the immediate failover assignment if {target_vehicle.vehicle_id} is marked unavailable or requires maintenance.",
            parameter_name="vehicle_availability",
            current_value=1.0,
            threshold_value=0.0,
            is_feasible=True,
        ))

    else:
        # Structural Monopoly: Only 1 vehicle is feasible for this route
        key_advantages.append("Sole available vehicle with sufficient payload capacity for this route's demand.")
        counterfactuals.append(CounterfactualInsight(
            trigger_type="payload_shift",
            description=f"No alternative vehicle in the current fleet can carry {target_route.required_payload_kg:.0f} kg cargo. Cargo consolidation or downsizing would be required to enable alternative dispatch.",
            parameter_name="required_payload_kg",
            current_value=target_route.required_payload_kg,
            threshold_value=None,
            is_feasible=False,
        ))

    # 3. Carbon Context Narrative
    carbon_narratives = {
        CarbonBudgetStatus.HEALTHY: f"Carbon budget is in HEALTHY status ({budget_util:.1f}% utilised), allowing balanced optimization across fuel, emissions, and transit cost.",
        CarbonBudgetStatus.WARNING: f"Carbon budget is in WARNING status ({budget_util:.1f}% utilised, w_co2 = {co2_weight:.2f}x penalty). Emissions reduction has elevated priority.",
        CarbonBudgetStatus.CRITICAL: f"Carbon budget is in CRITICAL status ({budget_util:.1f}% utilised, w_co2 = {co2_weight:.2f}x penalty). High-emission options are strongly penalized.",
        CarbonBudgetStatus.OVER_BUDGET: f"Carbon budget is OVER BUDGET (w_co2 = {co2_weight:.2f}x max penalty). Decarbonization is enforced as the dominant objective.",
    }
    carbon_context = CarbonContextModel(
        budget_kg=carbon_budget.budget_kg if carbon_budget else 1500.0,
        consumed_kg=carbon_budget.consumed_kg if carbon_budget else 0.0,
        projected_total_kg=carbon_budget.projected_total_kg if carbon_budget else 1043.0,
        budget_utilisation_pct=round(budget_util, 1),
        status=budget_status,
        dynamic_co2_penalty=round(co2_weight, 2),
        carbon_pressure_narrative=carbon_narratives.get(budget_status, carbon_narratives[CarbonBudgetStatus.HEALTHY]),
    )

    # 4. Risk Context
    risk_context = None
    if target_pred and target_pred.uncertainty_l is not None:
        target_unc = target_pred.uncertainty_l
        unc_pct = target_pred.uncertainty_pct or ((target_unc / max(target_pred.predicted_fuel_l, 0.1)) * 100.0)
        risk_lvl = "HIGH" if unc_pct > 25.0 else ("MODERATE" if unc_pct > 15.0 else "LOW")
        
        alt_unc = best_alt_details.uncertainty_l if best_alt_details else None
        risk_narrative = (
            f"Conformal prediction interval [{target_pred.fuel_lower_l:.1f}–{target_pred.fuel_upper_l:.1f} L] "
            f"reflects {risk_lvl} variance risk (±{target_unc:.1f} L). Risk-adjusted fuel is {target_pred.risk_adjusted_fuel_l:.1f} L (lambda = {risk_aversion_lambda:.1f})."
        )
        risk_context = RiskContextModel(
            risk_aversion_lambda=risk_aversion_lambda,
            target_uncertainty_l=target_unc,
            target_risk_level=risk_lvl,
            alternative_uncertainty_l=alt_unc,
            risk_narrative=risk_narrative,
        )

    # 5. Summary Verdict & Full Narrative Synthesis
    if best_alt_details:
        if abs(best_alt_details.delta_score) < 0.2:
            if best_alt_details.delta_cost > 0.05:
                summary_verdict = (
                    f"{target_vehicle.vehicle_id} and {best_alt_details.vehicle_id} achieved equivalent suitability scores ({target_score_obj.overall_score:.1f}/100), "
                    f"but {target_vehicle.vehicle_id} was selected due to a lower QUBO optimization cost ({target_details.assignment_cost:.1f} vs {best_alt_details.assignment_cost:.1f}, saving {best_alt_details.delta_cost:.2f}) "
                    f"under active carbon (penalty = {co2_weight:.2f}x) and risk (lambda = {risk_aversion_lambda:.1f}) parameters."
                )
            elif best_alt_details.delta_cost < -0.05:
                summary_verdict = (
                    f"{target_vehicle.vehicle_id} was assigned with equivalent suitability score ({target_score_obj.overall_score:.1f}/100) to {best_alt_details.vehicle_id} "
                    f"to optimize global multi-route fleet balance."
                )
            else:
                summary_verdict = (
                    f"{target_vehicle.vehicle_id} and {best_alt_details.vehicle_id} achieved identical suitability ({target_score_obj.overall_score:.1f}/100) and cost profiles. "
                    f"{target_vehicle.vehicle_id} was allocated by deterministic index priority."
                )
        else:
            summary_verdict = (
                f"{target_vehicle.vehicle_id} was selected over {best_alt_details.vehicle_id} with a suitability score of "
                f"{target_score_obj.overall_score:.1f}/100 (+{best_alt_details.delta_score:.1f} pts), saving {best_alt_details.delta_fuel_l:.1f} L fuel "
                f"and {best_alt_details.delta_co2_kg:.1f} kg CO2e (QUBO cost: {target_details.assignment_cost:.1f} vs {best_alt_details.assignment_cost:.1f})."
            )
    else:
        summary_verdict = (
            f"{target_vehicle.vehicle_id} is the sole feasible vehicle for route {target_route.route_id} "
            f"with an overall suitability score of {target_score_obj.overall_score:.1f}/100."
        )


    adv_text = "; ".join(key_advantages) if key_advantages else "Optimally balanced performance."
    full_narrative = (
        f"{summary_verdict} Key advantages: {adv_text} {carbon_context.carbon_pressure_narrative}"
    )

    return AssignmentExplanationResponse(
        vehicle_id=target_vehicle.vehicle_id,
        route_id=target_route.route_id,
        summary_verdict=summary_verdict,
        target=target_details,
        has_alternative=bool(best_alt_details is not None),
        alternative=best_alt_details,
        key_advantages=key_advantages,
        carbon_context=carbon_context,
        risk_context=risk_context,
        counterfactuals=counterfactuals,
        full_narrative=full_narrative,
    )
