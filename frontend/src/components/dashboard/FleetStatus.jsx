import React from 'react'
import { Truck, Fuel, ArrowRight, Gauge, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'

export default function FleetStatus({ state, benchmark }) {
  const vehicles = state?.vehicles || []
  const assignments = state?.greenflow_assignments?.length
    ? state.greenflow_assignments
    : state?.baseline_assignments || []

  const assignmentMap = {}
  assignments.forEach((a) => {
    assignmentMap[a.vehicle_id] = a
  })

  const getEfficiencyBadge = (v, assignment) => {
    if (!v.available) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
          OFFLINE
        </span>
      )
    }
    if (!assignment || assignment.status === 'unassigned') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
          STANDBY
        </span>
      )
    }
    if (v.fuel_type === 'Electric' || v.fuel_type === 'Hybrid') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          ECO OPTIMAL
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
        STANDARD
      </span>
    )
  }

  const getProgressBarColor = (fuelType) => {
    if (fuelType === 'Electric') return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
    if (fuelType === 'Hybrid') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
    return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Fleet Telemetry & Status
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {vehicles.length} Units ({state?.scenario || 'Normal'})
        </span>
      </div>

      {/* Vehicle Rows List */}
      <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[420px] p-2 space-y-2">
        {vehicles.map((v) => {
          const assignment = assignmentMap[v.vehicle_id]
          const isAssigned = assignment && assignment.status === 'assigned'
          const fuel = assignment?.predicted_fuel_l ? `${assignment.predicted_fuel_l} L` : `${v.fuel_capacity_l} L Tank`
          const fuelPct = Math.min(100, Math.round(((assignment?.predicted_fuel_l || 20) / v.fuel_capacity_l) * 100))

          return (
            <div
              key={v.vehicle_id}
              className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 hover:border-slate-700/80 transition-all"
            >
              {/* Top row: ID, Type, Route, and Efficiency */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white tracking-wide">
                    {v.vehicle_id}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">
                    {v.vehicle_type} • {v.fuel_type}
                  </span>
                  {isAssigned && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <ArrowRight className="h-3 w-3 text-slate-500" />
                      <span className="font-medium text-emerald-400 font-mono">{assignment.route_id}</span>
                    </div>
                  )}
                </div>
                {getEfficiencyBadge(v, assignment)}
              </div>

              {/* Fuel Consumption Metric & Bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Fuel className="h-3 w-3 text-slate-400" />
                    Trip Consumption / Capacity
                  </span>
                  <span className="font-mono font-medium text-slate-200">{fuel}</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getProgressBarColor(v.fuel_type)}`}
                    style={{ width: `${Math.max(15, fuelPct)}%` }}
                  />
                </div>
              </div>

              {/* Sub-telemetry Footer */}
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Max Payload: <span className="text-slate-300">{v.max_payload_kg} kg</span></span>
                <span>CO₂ Est: <span className="text-slate-300">{assignment?.estimated_co2_kg ? `${assignment.estimated_co2_kg} kg` : 'N/A'}</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
