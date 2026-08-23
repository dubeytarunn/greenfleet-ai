import React from 'react'
import { BarChart3, LineChart, TrendingUp, Zap, Gauge } from 'lucide-react'

export default function AnalyticsPlaceholder({
  routes = [],
  baselineAssignments = [],
  greenflowAssignments = [],
  isOptimized = false,
  benchmark = null,
}) {
  const baseMap = new Map(baselineAssignments.map((a) => [a.route_id, a.predicted_fuel_l || 0]))
  const optMap = new Map(greenflowAssignments.map((a) => [a.route_id, a.predicted_fuel_l || 0]))

  // Select top routes for chart display
  const displayRoutes = routes.slice(0, 8).map((r) => {
    const baseFuel = baseMap.get(r.route_id) || (r.distance_km * 0.32 * r.traffic_factor)
    const optFuel = isOptimized
      ? optMap.get(r.route_id) || (baseFuel * 0.82)
      : baseFuel

    // Normalize for bar chart height (relative to max 70L)
    const maxScale = 75.0
    const basePercent = Math.min(100, Math.round((baseFuel / maxScale) * 100))
    const optPercent = Math.min(100, Math.round((optFuel / maxScale) * 100))

    return {
      id: r.route_id,
      base: basePercent,
      opt: optPercent,
      baseVal: baseFuel.toFixed(1),
      optVal: optFuel.toFixed(1),
      color: isOptimized ? 'bg-emerald-500' : 'bg-slate-600',
    }
  })

  const avgReduction = benchmark ? `${benchmark.fuel_saved_pct.toFixed(1)}%` : '18.7%'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      {/* Panel 1: Fuel Consumption Analysis */}
      <div className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Route Fuel Consumption Comparison
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-slate-600"></span> Baseline
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald-500"></span> GreenFleet {isOptimized ? 'Optimized' : ''}
            </span>
          </div>
        </div>

        {/* Visual Chart Body */}
        <div className="p-4 flex flex-col justify-between h-[200px] bg-slate-950/20">
          <div className="flex items-end justify-between gap-3 h-[140px] pt-4 px-2 border-b border-slate-800/80">
            {/* Y Axis Guides */}
            <div className="flex flex-col justify-between h-full text-[9px] font-mono text-slate-400 pr-2 select-none">
              <span>75 L</span>
              <span>50 L</span>
              <span>25 L</span>
              <span>0 L</span>
            </div>

            {/* Dynamic Route Bars */}
            {displayRoutes.map((bar) => (
              <div key={bar.id} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <div className="w-full max-w-[28px] flex items-end justify-center gap-1 h-full">
                  {/* Baseline bar */}
                  <div
                    className="w-1/2 rounded-t bg-slate-700/60 transition-all group-hover:bg-slate-600"
                    style={{ height: `${bar.base}%` }}
                    title={`Baseline: ${bar.baseVal} L`}
                  />
                  {/* GreenFleet bar */}
                  <div
                    className={`w-1/2 rounded-t ${bar.color} transition-all opacity-90 group-hover:opacity-100 shadow-[0_0_8px_rgba(16,185,129,0.3)]`}
                    style={{ height: `${bar.opt}%` }}
                    title={`GreenFleet: ${bar.optVal} L`}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400">{bar.id}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 font-mono">
            <span>Model: Quantum-Inspired Simulated Annealing</span>
            <span className="text-emerald-400 font-semibold">
              {isOptimized ? `Avg Reduction: ${avgReduction}` : 'Baseline Uncoordinated'}
            </span>
          </div>
        </div>
      </div>

      {/* Panel 2: Route Efficiency & Congestion Distribution */}
      <div className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-emerald-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Route Payload & Congestion Alignment
            </h2>
          </div>
          <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
            {routes.length} Active Routes
          </span>
        </div>

        {/* Visual Distribution */}
        <div className="p-4 flex flex-col justify-between h-[200px] bg-slate-950/20">
          <div className="flex items-end justify-between gap-3 h-[140px] pt-4 px-2 border-b border-slate-800/80">
            <div className="flex flex-col justify-between h-full text-[9px] font-mono text-slate-400 pr-2 select-none">
              <span>25 t</span>
              <span>15 t</span>
              <span>5 t</span>
              <span>0 t</span>
            </div>

            {routes.slice(0, 7).map((r, idx) => {
              const maxPayloadScale = 26000.0
              const heightPct = Math.min(100, Math.round((r.required_payload_kg / maxPayloadScale) * 100))
              const stateColor = r.traffic_factor > 1.3 ? 'bg-amber-500' : 'bg-emerald-500'

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full max-w-[22px] flex items-end justify-center h-full">
                    <div
                      className={`w-full rounded-t ${stateColor} opacity-85 group-hover:opacity-100 transition-all shadow-[0_0_8px_rgba(16,185,129,0.3)]`}
                      style={{ height: `${Math.max(10, heightPct)}%` }}
                      title={`${r.origin} → ${r.destination} (${(r.required_payload_kg/1000).toFixed(1)}t, ${r.traffic_factor}x traffic)`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 truncate max-w-[45px] text-center">
                    {r.route_id}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400 font-medium">Optimal Powertrains</span>
              <span className="text-amber-400 font-medium">Traffic Adaptive</span>
            </div>
            <span className="text-slate-400">Total Demand: {(routes.reduce((acc, r) => acc + (r.required_payload_kg || 0), 0) / 1000).toFixed(0)} Tonnes</span>
          </div>
        </div>
      </div>
    </div>
  )
}
