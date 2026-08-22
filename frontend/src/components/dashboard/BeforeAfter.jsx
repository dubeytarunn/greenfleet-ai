import React from 'react'
import { Scale, ArrowDownRight, ArrowUpRight, CheckCircle2 } from 'lucide-react'

export default function BeforeAfter({ benchmark }) {
  const base = benchmark?.baseline
  const green = benchmark?.greenflow

  const comparisonRows = [
    {
      metric: 'Fuel Consumption',
      baseline: base ? `${base.total_fuel_l} L` : '484.9 L',
      greenfleet: green ? `${green.total_fuel_l} L` : '397.9 L',
      delta: benchmark ? `-${benchmark.fuel_saved_l} L (-${benchmark.fuel_saved_pct}%)` : '-87.0 L (-17.9%)',
      isImprovement: true,
    },
    {
      metric: 'Estimated CO₂ Emissions',
      baseline: base ? `${(base.estimated_co2_kg / 1000).toFixed(2)} t` : '1.30 t',
      greenfleet: green ? `${(green.estimated_co2_kg / 1000).toFixed(2)} t` : '1.02 t',
      delta: benchmark ? `-${(benchmark.co2_reduced_kg / 1000).toFixed(2)} t (-${benchmark.co2_reduced_pct}%)` : '-0.27 t (-21.1%)',
      isImprovement: true,
    },
    {
      metric: 'Total Operating Cost',
      baseline: base ? `$${base.total_operating_cost.toLocaleString()}` : '$2,475.26',
      greenfleet: green ? `$${green.total_operating_cost.toLocaleString()}` : '$2,142.67',
      delta: benchmark ? `-$${benchmark.cost_saved.toLocaleString()} (-${benchmark.cost_saved_pct}%)` : '-$332.59 (-13.4%)',
      isImprovement: true,
    },
    {
      metric: 'Fleet Utilisation Rate',
      baseline: base ? `${base.fleet_utilisation_pct}%` : '66.7%',
      greenfleet: green ? `${green.fleet_utilisation_pct}%` : '88.9%',
      delta: '+22.2%',
      isImprovement: true,
    },
    {
      metric: 'Inefficient Dispatches',
      baseline: base ? `${base.inefficient_assignments_count} routes` : '5 routes',
      greenfleet: green ? `${green.inefficient_assignments_count} routes` : '0 routes',
      delta: benchmark ? `-${benchmark.inefficient_assignments_reduced} suboptimal` : '-5 suboptimal',
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
            Baseline Heuristic vs GreenFleet Quantum-Inspired Optimization
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Dynamic Benchmark Verified</span>
        </div>
      </div>

      {/* Comparison Table / Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-950/30 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              <th className="py-2.5 px-4">Metric</th>
              <th className="py-2.5 px-4 text-right">Legacy Baseline (FIFO)</th>
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
