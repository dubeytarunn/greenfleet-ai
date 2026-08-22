import React, { useState } from 'react'
import { Truck, Fuel, ArrowRight, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function FleetStatus({
  vehicles = [],
  routes = [],
  assignments = [],
  scoringMap = {},
  isOptimized = false,
}) {
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)

  // Map lookups
  const routeMap = new Map(routes.map((r) => [r.route_id, r]))
  const assignmentMap = new Map(assignments.map((a) => [a.vehicle_id, a]))

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
    <div className="flex flex-col h-full rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
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
    </div>
  )
}
