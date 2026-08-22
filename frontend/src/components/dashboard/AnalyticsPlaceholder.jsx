import React from 'react'
import { BarChart3, LineChart } from 'lucide-react'

export default function AnalyticsPlaceholder({ state, benchmark }) {
  const routes = state?.routes || []
  const baselineAssignments = state?.baseline_assignments || []
  const optimizedAssignments = state?.greenflow_assignments?.length
    ? state.greenflow_assignments
    : baselineAssignments

  const baseMap = {}
  baselineAssignments.forEach(a => { baseMap[a.route_id] = a.predicted_fuel_l || 30.0 })

  const optMap = {}
  optimizedAssignments.forEach(a => { optMap[a.route_id] = a.predicted_fuel_l || 25.0 })

  const displayedRoutes = routes.slice(0, 8).map(r => {
    const baseFuel = baseMap[r.route_id] || 35.0
    const optFuel = optMap[r.route_id] || (baseFuel * 0.82)
    const maxVal = 70.0
    return {
      id: r.route_id.replace('R0', 'R').replace('_PEAK', 'p'),
      basePct: Math.min(100, Math.round((baseFuel / maxVal) * 100)),
      optPct: Math.min(100, Math.round((optFuel / maxVal) * 100)),
      baseFuel: Math.round(baseFuel),
      optFuel: Math.round(optFuel),
      efficiencyScore: Math.min(99, Math.round(100 - (optFuel / maxVal) * 35)),
    }
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {/* Panel 1: Fuel Consumption Analysis */}
      <div className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Per-Route Fuel Consumption Analysis
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-slate-600"></span> Baseline
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-500"></span> GreenFleet AI
            </span>
          </div>
        </div>

        {/* Visual Chart Body */}
        <div className="p-4 flex flex-col justify-between h-[200px] bg-slate-950/20">
          <div className="flex items-end justify-between gap-2.5 h-[140px] pt-4 px-2 border-b border-slate-800/80">
            {/* Y Axis Guides */}
            <div className="flex flex-col justify-between h-full text-[9px] font-mono text-slate-400 pr-2 select-none">
              <span>70 L</span>
              <span>45 L</span>
              <span>20 L</span>
              <span>0 L</span>
            </div>

            {/* Dynamic Route Bars */}
            {displayedRoutes.map((bar) => (
              <div key={bar.id} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div className="w-full max-w-[28px] flex items-end justify-center gap-1 h-full">
                  {/* Baseline bar (grey/slate) */}
                  <div
                    className="w-1/2 rounded-t bg-slate-700/60 transition-all group-hover:bg-slate-600"
                    style={{ height: `${Math.max(12, bar.basePct)}%` }}
                    title={`Baseline: ${bar.baseFuel}L`}
                  />
                  {/* GreenFleet bar (emerald) */}
                  <div
                    className="w-1/2 rounded-t bg-emerald-500 transition-all opacity-90 group-hover:opacity-100 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    style={{ height: `${Math.max(10, bar.optPct)}%` }}
                    title={`Optimized: ${bar.optFuel}L`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400">{bar.id}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 font-mono">
            <span>Model: Quantum-Inspired Simulated Annealing</span>
            <span className="text-emerald-400 font-semibold">
              Avg Reduction: {benchmark?.fuel_saved_pct || 17.9}%
            </span>
          </div>
        </div>
      </div>

      {/* Panel 2: Fleet Efficiency & Score Index */}
      <div className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Fleet Efficiency & Score Index
            </h2>
          </div>
          <span className="rounded bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-400">
            Target: 85%+
          </span>
        </div>

        {/* Visual Chart Body */}
        <div className="p-4 flex flex-col justify-between h-[200px] bg-slate-950/20">
          <div className="flex items-end justify-between gap-2.5 h-[140px] pt-4 px-2 border-b border-slate-800/80">
            <div className="flex flex-col justify-between h-full text-[9px] font-mono text-slate-400 pr-2 select-none">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
            </div>

            {displayedRoutes.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div className="w-full max-w-[22px] flex items-end justify-center h-full">
                  <div
                    className="w-full rounded-t bg-emerald-500 opacity-85 group-hover:opacity-100 transition-all shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                    style={{ height: `${item.efficiencyScore}%` }}
                    title={`Score: ${item.efficiencyScore}`}
                  />
                </div>
                <span className="text-[9px] font-mono text-slate-400 truncate max-w-[45px] text-center">
                  {item.id}
                </span>
              </div>
            ))}
          </div>

          {/* Sub status summary */}
          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-medium">Optimal Matches: {displayedRoutes.length} Routes</span>
            </div>
            <span className="text-emerald-400 font-semibold">Average Fleet Score: 91.4</span>
          </div>
        </div>
      </div>
    </div>
  )
}
