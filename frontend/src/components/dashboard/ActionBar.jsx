import React from 'react'
import { Flame, Sparkles, RotateCcw, PlayCircle, Gauge, Loader2, Navigation } from 'lucide-react'

export default function ActionBar({
  scenario = 'normal',
  status = 'normal_state',
  isOptimized = false,
  loading = false,
  activeAction = null,
  carbonBudget = null,
  onReset,
  onSimulatePeak,
  onSimulateTraffic,
  onOptimize,
  onOpenWhatIf,
  onOpenScenarios,
  onOpenShiftSummary,
}) {
  const getScenarioLabel = () => {
    switch (scenario) {
      case 'peak_demand':
        return {
          title: 'Peak Demand Surge',
          tag: 'Payload +25%',
          dotColor: 'bg-rose-400',
          textColor: 'text-rose-400',
          badgeBg: 'bg-rose-500/10 border-rose-500/30',
        }
      case 'high_traffic':
        return {
          title: 'High Traffic Congestion',
          tag: 'Congestion 1.6x',
          dotColor: 'bg-amber-400',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/10 border-amber-500/30',
        }
      case 'normal':
      default:
        return {
          title: 'Normal Baseline State',
          tag: 'Standard Operations',
          dotColor: 'bg-emerald-400',
          textColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/10 border-emerald-500/30',
        }
    }
  }

  const scenarioMeta = getScenarioLabel()

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-2.5 shadow-md shadow-black/20 backdrop-blur-sm">
      {/* Left: Simulation State Indicator */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-300">Simulation Controls</span>
          <span className="text-slate-500">|</span>
          <span className="text-xs text-slate-400">Scenario:</span>
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border ${scenarioMeta.badgeBg} ${scenarioMeta.textColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${scenarioMeta.dotColor} animate-pulse`}></span>
            {scenarioMeta.title} ({scenarioMeta.tag})
          </span>

          {isOptimized && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-bold text-emerald-300">
              <Sparkles className="h-3 w-3 text-emerald-400" />
              Quantum Optimized
            </span>
          )}

          {carbonBudget && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium border ${
                carbonBudget.status === 'HEALTHY'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : carbonBudget.status === 'WARNING'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : carbonBudget.status === 'CRITICAL'
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300 animate-pulse'
              }`}
              title={`Consumed: ${carbonBudget.consumed_kg}kg, Projected: ${carbonBudget.projected_kg}kg, Headroom: ${carbonBudget.budget_headroom_kg}kg, Dynamic Penalty: ${carbonBudget.dynamic_co2_penalty}x`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                carbonBudget.status === 'HEALTHY' ? 'bg-emerald-400' :
                carbonBudget.status === 'WARNING' ? 'bg-amber-400' :
                carbonBudget.status === 'CRITICAL' ? 'bg-orange-400' : 'bg-rose-400'
              }`}></span>
              Carbon: {carbonBudget.status} ({carbonBudget.budget_utilisation_pct.toFixed(0)}% • w_co2={carbonBudget.dynamic_co2_penalty}x)
            </span>
          )}
        </div>
      </div>


      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
        {/* Simulate Peak Demand Button */}
        <button
          type="button"
          onClick={onSimulatePeak}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            scenario === 'peak_demand' ? 'ring-1 ring-rose-400/50 bg-rose-500/30' : ''
          }`}
          title="Simulate surge in payload demand across delivery routes"
        >
          {activeAction === 'peak' ? (
            <Loader2 className="h-3.5 w-3.5 text-rose-400 animate-spin" />
          ) : (
            <Flame className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span>Peak Demand</span>
        </button>

        {/* Simulate High Traffic Button */}
        <button
          type="button"
          onClick={onSimulateTraffic}
          disabled={loading}
          className={`flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
            scenario === 'high_traffic' ? 'ring-1 ring-amber-400/50 bg-amber-500/30' : ''
          }`}
          title="Simulate severe arterial traffic and congestion delays"
        >
          {activeAction === 'traffic' ? (
            <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
          ) : (
            <Navigation className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>High Traffic</span>
        </button>

        {/* Run GreenFleet Optimisation Button */}
        <button
          type="button"
          onClick={onOptimize}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-200 px-3.5 py-1.5 text-xs font-bold transition-all shadow-md shadow-emerald-950/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Execute Quantum-Inspired Simulated Annealing allocation to minimize fuel and CO2"
        >
          {activeAction === 'optimize' ? (
            <Loader2 className="h-3.5 w-3.5 text-emerald-300 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          )}
          <span>Run GreenFleet Optimisation</span>
        </button>

        {/* Reset Button */}
        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset fleet and route network to initial normal state"
        >
          {activeAction === 'reset' ? (
            <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span>Reset</span>
        </button>

        <span className="text-slate-600 hidden md:inline">|</span>

        {/* Commercial Decision Support Action Triggers */}
        {onOpenWhatIf && (
          <button
            type="button"
            onClick={onOpenWhatIf}
            className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 px-2.5 py-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="Open 4-parameter interactive What-If Simulator"
          >
            <span>What-If</span>
          </button>
        )}

        {onOpenScenarios && (
          <button
            type="button"
            onClick={onOpenScenarios}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="View 4-scenario comparative planning matrix"
          >
            <span>Scenarios</span>
          </button>
        )}

        {onOpenShiftSummary && (
          <button
            type="button"
            onClick={onOpenShiftSummary}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-2.5 py-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95"
            title="View complete shift dispatch & sustainability report"
          >
            <span>Shift Summary</span>
          </button>
        )}
      </div>
    </div>
  )
}

