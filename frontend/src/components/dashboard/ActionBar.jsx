import React from 'react'
import { Flame, Sparkles, RotateCcw, PlayCircle, Loader2, Navigation } from 'lucide-react'

export default function ActionBar({
  scenario = 'normal',
  status = 'ready',
  loading = false,
  activeAction = '',
  onReset,
  onPeak,
  onTraffic,
  onOptimize,
}) {
  const getScenarioBadge = (sc) => {
    switch (sc) {
      case 'peak_demand':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping"></span>
            Peak Surge Active (+30% Demand)
          </span>
        )
      case 'high_traffic':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
            High Traffic Congestion (1.75x)
          </span>
        )
      case 'normal':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            Normal Fleet State
          </span>
        )
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-2.5 shadow-md shadow-black/20 backdrop-blur-sm">
      {/* Left: Simulation State Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <PlayCircle className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Simulation Controls</span>
          <span className="text-slate-500">|</span>
          <span className="text-xs text-slate-400">Current:</span>
          {getScenarioBadge(scenario)}
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {/* Simulate Peak Demand Button */}
        <button
          type="button"
          disabled={loading}
          onClick={onPeak}
          className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loading && activeAction === 'peak' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
          ) : (
            <Flame className="h-3.5 w-3.5 text-rose-400" />
          )}
          <span>Simulate Peak Demand</span>
        </button>

        {/* Simulate High Traffic Button */}
        <button
          type="button"
          disabled={loading}
          onClick={onTraffic}
          className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loading && activeAction === 'traffic' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
          ) : (
            <Navigation className="h-3.5 w-3.5 text-amber-400" />
          )}
          <span>Simulate High Traffic</span>
        </button>

        {/* Run GreenFleet Optimisation Button */}
        <button
          type="button"
          disabled={loading}
          onClick={onOptimize}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/30 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loading && activeAction === 'optimize' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          )}
          <span>Run GreenFleet Optimisation</span>
        </button>

        {/* Reset Button */}
        <button
          type="button"
          disabled={loading}
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {loading && activeAction === 'reset' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span>Reset</span>
        </button>
      </div>
    </div>
  )
}
