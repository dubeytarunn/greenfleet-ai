import React from 'react'
import { Scale, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertTriangle } from 'lucide-react'

export default function BeforeAfter({
  benchmark = null,
  isOptimized = false,
}) {
  const baseline = benchmark?.baseline
  const greenflow = benchmark?.greenflow

  const comparisonRows = [
    {
      metric: 'Total Fuel Consumption',
      baseline: baseline ? `${baseline.total_fuel_l.toFixed(1)} L` : '--',
      greenfleet: greenflow ? `${greenflow.total_fuel_l.toFixed(1)} L` : '--',
      delta: benchmark ? `-${benchmark.fuel_saved_l.toFixed(1)} L (-${benchmark.fuel_saved_pct.toFixed(1)}%)` : '--',
      isImprovement: true,
    },
    {
      metric: 'Estimated CO₂ Emissions',
      baseline: baseline ? `${(baseline.estimated_co2_kg / 1000).toFixed(2)} t (${baseline.estimated_co2_kg.toFixed(0)} kg)` : '--',
      greenfleet: greenflow ? `${(greenflow.estimated_co2_kg / 1000).toFixed(2)} t (${greenflow.estimated_co2_kg.toFixed(0)} kg)` : '--',
      delta: benchmark ? `-${(benchmark.co2_reduced_kg / 1000).toFixed(2)} t (-${benchmark.co2_reduced_pct.toFixed(1)}%)` : '--',
      isImprovement: true,
    },
    {
      metric: 'Total Operating Cost',
      baseline: baseline ? `$${baseline.total_operating_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--',
      greenfleet: greenflow ? `$${greenflow.total_operating_cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '--',
      delta: benchmark ? `-$${benchmark.cost_saved.toLocaleString(undefined, { maximumFractionDigits: 0 })} (-${benchmark.cost_saved_pct.toFixed(1)}%)` : '--',
      isImprovement: true,
    },
    {
      metric: 'Fleet Utilisation Rate',
      baseline: baseline ? `${baseline.fleet_utilisation_pct.toFixed(0)}%` : '--',
      greenfleet: greenflow ? `${greenflow.fleet_utilisation_pct.toFixed(0)}%` : '--',
      delta: benchmark
        ? `${(greenflow.fleet_utilisation_pct - baseline.fleet_utilisation_pct) >= 0 ? '+' : ''}${(greenflow.fleet_utilisation_pct - baseline.fleet_utilisation_pct).toFixed(1)}%`
        : '--',
      isImprovement: true,
    },
    {
      metric: 'Inefficient Pairings',
      baseline: baseline ? `${baseline.inefficient_assignments_count} routes` : '--',
      greenfleet: greenflow ? `${greenflow.inefficient_assignments_count} routes` : '--',
      delta: benchmark ? `-${benchmark.inefficient_assignments_reduced} eliminated` : '--',
      isImprovement: true,
    },
  ]

  return (
    <div className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur-sm overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-2.5 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Baseline Heuristic vs GreenFleet Optimization
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          {isOptimized ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Optimisation Verified ({benchmark?.scenario || 'Active'})</span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-400">Baseline Active (Run Optimisation to compare)</span>
            </>
          )}
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-950/30 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              <th className="py-2.5 px-4">Metric</th>
              <th className="py-2.5 px-4 text-right">Uncoordinated Baseline</th>
              <th className="py-2.5 px-4 text-right">GreenFleet AI</th>
              <th className="py-2.5 px-4 text-right">Impact / Savings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-mono">
            {comparisonRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4 font-sans font-medium text-slate-200 text-xs">
                  {row.metric}
                </td>
                <td className="py-3 px-4 text-right text-slate-400">
                  {row.baseline}
                </td>
                <td className="py-3 px-4 text-right font-bold text-white">
                  <span className="inline-block rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-300">
                    {row.greenfleet}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 text-xs">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {row.delta}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
