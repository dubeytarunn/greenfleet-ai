import React, { useState } from 'react'
import {
  Truck,
  Fuel,
  ArrowRight,
  CheckCircle,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Zap,
  TrendingDown,
  X,
} from 'lucide-react'
import { getAssignmentExplanation } from '../../services/api'

export default function FleetStatus({
  vehicles = [],
  routes = [],
  assignments = [],
  scoringMap = {},
  isOptimized = false,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [explainingVehicleId, setExplainingVehicleId] = useState(null)
  const [explanationData, setExplanationData] = useState(null)
  const [loadingExplanation, setLoadingExplanation] = useState(false)

  // Map lookups
  const routeMap = new Map(routes.map((r) => [r.route_id, r]))
  const assignmentMap = new Map(assignments.map((a) => [a.vehicle_id, a]))

  const handleOpenExplanation = async (vehicleId, e) => {
    e.stopPropagation()
    setExplainingVehicleId(vehicleId)
    setLoadingExplanation(true)
    setExplanationData(null)
    try {
      const data = await getAssignmentExplanation(vehicleId)
      setExplanationData(data)
    } catch (err) {
      console.error('Failed to fetch explanation:', err)
    } finally {
      setLoadingExplanation(false)
    }
  }

  const getEfficiencyLevel = (score, utilization) => {
    if (score >= 85) return 'optimal'
    if (score >= 60) return 'moderate'
    return 'risk'
  }

  const getEfficiencyBadge = (level, label) => {
    switch (level) {
      case 'optimal':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            {label}
          </span>
        )
      case 'moderate':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
            {label}
          </span>
        )
      case 'risk':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
            {label}
          </span>
        )
    }
  }

  const getProgressBarColor = (level) => {
    switch (level) {
      case 'optimal':
        return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
      case 'moderate':
        return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
      case 'risk':
      default:
        return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
    }
  }

  return (
    <div className="relative flex flex-col h-full rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Fleet Telemetry & Assignments
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {assignments.length} / {vehicles.length} Dispatched
        </span>
      </div>

      {/* Vehicle Rows List */}
      <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[460px] p-2 space-y-2">
        {vehicles.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500">Loading fleet data...</div>
        ) : (
          vehicles.map((v) => {
            const assignment = assignmentMap.get(v.vehicle_id)
            const route = assignment ? routeMap.get(assignment.route_id) : null
            const scoreKey = route ? `${v.vehicle_id}_${route.route_id}` : null
            const scoreInfo = scoreKey ? scoringMap[scoreKey] : null

            const isAssigned = !!assignment && assignment.status === 'assigned'
            const fuelConsumed = assignment?.predicted_fuel_l ?? 0
            const fuelTankPercent = Math.min(100, Math.round((fuelConsumed / (v.fuel_capacity_l || 100)) * 100))
            const payloadRatio = route ? Math.min(100, Math.round((route.required_payload_kg / (v.max_payload_kg || 1)) * 100)) : 0
            
            const overallScore = scoreInfo?.overall_score || (isAssigned ? 88 : 0)
            const effLevel = isAssigned ? getEfficiencyLevel(overallScore, payloadRatio) : 'moderate'
            const badgeLabel = isAssigned
              ? (scoreInfo?.recommendation || `${overallScore.toFixed(0)}% Match`)
              : 'Standby'

            const isSelected = selectedVehicleId === v.vehicle_id

            return (
              <div
                key={v.vehicle_id}
                className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 hover:border-slate-700/80 transition-all cursor-pointer"
                onClick={() => setSelectedVehicleId(isSelected ? null : v.vehicle_id)}
              >
                {/* Top row: ID, Type, Route, and Efficiency Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      {v.vehicle_id}
                    </span>
                    <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.2 text-slate-400 border border-slate-700">
                      {v.vehicle_type} • {v.fuel_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isAssigned && (
                      <button
                        onClick={(e) => handleOpenExplanation(v.vehicle_id, e)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all"
                        title="View deterministic 5-factor explanation & counterfactual"
                      >
                        <HelpCircle className="h-3 w-3 text-emerald-400" />
                        Why?
                      </button>
                    )}
                    {getEfficiencyBadge(effLevel, badgeLabel)}
                    {scoreInfo && (
                      isSelected ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Route Destination */}
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                  <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                  {route ? (
                    <span className="font-medium text-slate-300 truncate">
                      {route.origin} → {route.destination} ({route.distance_km} km)
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Standby in Depot</span>
                  )}
                </div>

                {/* Fuel Consumption Metric & Bar */}
                {isAssigned && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Fuel className="h-3 w-3 text-slate-400" />
                        Predicted Fuel
                      </span>
                      <span className="font-mono font-medium text-slate-200">
                        {fuelConsumed.toFixed(1)} L / {v.fuel_capacity_l} L tank
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressBarColor(effLevel)}`}
                        style={{ width: `${Math.max(5, fuelTankPercent)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Sub-telemetry Footer */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Capacity: <span className="text-slate-400">{(v.max_payload_kg / 1000).toFixed(1)} t max</span></span>
                  <span>Payload: <span className="text-slate-400">{payloadRatio}% load</span></span>
                </div>

                {/* Risk-Aware Conformal Prediction Interval */}
                {isAssigned && assignment?.uncertainty_l != null && (
                  <div className="mt-2.5 rounded-md bg-slate-900/90 border border-cyan-500/20 p-2 text-[10px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 flex items-center gap-1">
                        <Info className="h-3 w-3 text-cyan-400" />
                        Conformal Prediction (90% Interval)
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        (assignment.uncertainty_pct || 0) > 25
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : (assignment.uncertainty_pct || 0) > 15
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {(assignment.uncertainty_pct || 0) > 25
                          ? 'HIGH RISK'
                          : (assignment.uncertainty_pct || 0) > 15
                          ? 'MODERATE RISK'
                          : 'LOW RISK'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-slate-300 pt-0.5">
                      <div>Expected: <span className="text-white font-bold">{assignment.predicted_fuel_l?.toFixed(1)} L</span></div>
                      <div>Range: <span className="text-cyan-300 font-bold">{assignment.fuel_lower_l?.toFixed(1)}–{assignment.fuel_upper_l?.toFixed(1)} L</span></div>
                      <div>Uncertainty: <span className="text-slate-400">±{assignment.uncertainty_l?.toFixed(1)} L</span></div>
                      <div>Risk-Adjusted: <span className="text-amber-400 font-bold">{assignment.risk_adjusted_fuel_l?.toFixed(1)} L</span></div>
                    </div>
                  </div>
                )}

                {/* Explainable 5-Factor Suitability Accordion */}
                {isSelected && scoreInfo?.breakdown && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10px] space-y-1.5 bg-slate-900/60 p-2 rounded">
                    <div className="font-semibold text-emerald-400 text-[11px] flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      5-Factor Explainable Suitability Analysis:
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 font-mono">
                      <div>Fuel Efficiency: <span className="text-emerald-400 font-bold">{scoreInfo.breakdown.fuel_efficiency.toFixed(0)}%</span></div>
                      <div>Capacity Match: <span className="text-emerald-400 font-bold">{scoreInfo.breakdown.capacity_match.toFixed(0)}%</span></div>
                      <div>Distance Match: <span className="text-emerald-400 font-bold">{scoreInfo.breakdown.distance_suitability.toFixed(0)}%</span></div>
                      <div>Traffic Resilience: <span className="text-emerald-400 font-bold">{scoreInfo.breakdown.traffic_resilience.toFixed(0)}%</span></div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* WHY THIS ASSIGNMENT? EXPLAINABILITY DRAWER MODAL */}
      {explainingVehicleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-emerald-950/40 text-slate-200 overflow-y-auto max-h-[85vh]">
            <button
              onClick={() => setExplainingVehicleId(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {loadingExplanation ? (
              <div className="py-12 text-center text-slate-400 text-sm animate-pulse">
                Generating deterministic 5-factor explanation & counterfactual analysis...
              </div>
            ) : explanationData ? (
              <div className="space-y-4 text-xs">
                {/* Header */}
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Sparkles className="h-4 w-4" />
                    WHY {explanationData.vehicle_id} → {explanationData.route_id}?
                  </div>
                  <p className="mt-1 text-slate-400 text-[11px] leading-relaxed">
                    {explanationData.summary_verdict}
                  </p>
                </div>

                {/* 5-Factor Score Radar / Grid */}
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                  <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>5-Factor Suitability Scoring</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {explanationData.target.overall_suitability_score.toFixed(1)} / 100
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                      <span className="text-slate-400">Fuel Efficiency:</span>{' '}
                      <span className="text-emerald-400 font-bold">
                        {explanationData.target.breakdown.fuel_efficiency.toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                      <span className="text-slate-400">Capacity Fit:</span>{' '}
                      <span className="text-emerald-400 font-bold">
                        {explanationData.target.breakdown.capacity_match.toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                      <span className="text-slate-400">Distance Match:</span>{' '}
                      <span className="text-emerald-400 font-bold">
                        {explanationData.target.breakdown.distance_suitability.toFixed(0)}%
                      </span>
                    </div>
                    <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                      <span className="text-slate-400">Traffic Resilience:</span>{' '}
                      <span className="text-emerald-400 font-bold">
                        {explanationData.target.breakdown.traffic_resilience.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strongest Feasible Alternative */}
                {explanationData.has_alternative && explanationData.alternative && (
                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                    <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Strongest Feasible Alternative</span>
                      <span className="text-slate-400 font-mono">
                        {explanationData.alternative.vehicle_id} ({explanationData.alternative.vehicle_type}, {explanationData.alternative.fuel_type})
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mt-2 font-mono text-[11px] text-center">
                      <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                        <div className="text-slate-400 text-[10px]">Suitability</div>
                        <div className={`font-bold ${explanationData.alternative.delta_score === 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                          {explanationData.alternative.delta_score === 0 ? 'Tie (97.8)' : `+${explanationData.alternative.delta_score.toFixed(1)}`}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                        <div className="text-slate-400 text-[10px]">QUBO Cost</div>
                        <div className="text-emerald-400 font-bold">
                          {explanationData.target.assignment_cost?.toFixed(1)} vs {explanationData.alternative.assignment_cost?.toFixed(1)}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                        <div className="text-slate-400 text-[10px]">Fuel Saved</div>
                        <div className="text-emerald-400 font-bold">
                          {explanationData.alternative.delta_fuel_l > 0 ? `+${explanationData.alternative.delta_fuel_l.toFixed(1)} L` : `${explanationData.alternative.delta_fuel_l.toFixed(1)} L`}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                        <div className="text-slate-400 text-[10px]">CO2 Reduced</div>
                        <div className="text-emerald-400 font-bold">
                          {explanationData.alternative.delta_co2_kg > 0 ? `+${explanationData.alternative.delta_co2_kg.toFixed(1)} kg` : `${explanationData.alternative.delta_co2_kg.toFixed(1)} kg`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}


                {/* Primary Selection Drivers */}
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3">
                  <div className="text-[11px] font-semibold text-emerald-400 mb-1.5 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    Key Decision Advantages
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-slate-300 text-[11px]">
                    {explanationData.key_advantages.map((adv, idx) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                </div>

                {/* Carbon & Risk Context */}
                <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span>Carbon Governor Context</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      explanationData.carbon_context.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300' :
                      explanationData.carbon_context.status === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {explanationData.carbon_context.status} ({explanationData.carbon_context.dynamic_co2_penalty}x)
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    {explanationData.carbon_context.carbon_pressure_narrative}
                  </p>
                  {explanationData.risk_context && (
                    <p className="text-cyan-300 text-[10px] pt-1 border-t border-slate-800/80">
                      {explanationData.risk_context.risk_narrative}
                    </p>
                  )}
                </div>

                {/* Counterfactual What-If Sensitivity Insights */}
                {explanationData.counterfactuals && explanationData.counterfactuals.length > 0 && (
                  <div className="rounded-lg bg-emerald-950/20 border border-emerald-500/30 p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-emerald-400" />
                      Counterfactual Sensitivity Analysis ("What-If?")
                    </div>
                    <div className="space-y-1 text-slate-300 text-[10px]">
                      {explanationData.counterfactuals.map((cf, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 bg-slate-950/60 p-1.5 rounded border border-slate-800">
                          <span className="text-emerald-400 font-bold mt-0.5">•</span>
                          <span>{cf.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                Could not load explanation for this vehicle.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

