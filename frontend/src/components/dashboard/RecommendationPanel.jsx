import React from 'react'
import { Sparkles, AlertTriangle, ShieldCheck, ArrowRight, IndianRupee, CloudFog, Fuel, CheckCircle2 } from 'lucide-react'

export default function RecommendationPanel({ recommendation, isOptimized, onOptimize }) {
  if (!recommendation) return null

  const isWarning = recommendation.urgency_level === 'CAUTION'
  const isCritical = recommendation.urgency_level === 'ACTION_REQUIRED'

  const borderClass = isCritical
    ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/30 via-slate-900/60 to-slate-900/60'
    : isWarning
    ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/60'
    : 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-slate-900/60'

  const badgeClass = isCritical
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : isWarning
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'

  const IconComponent = isCritical ? AlertTriangle : isWarning ? AlertTriangle : ShieldCheck

  return (
    <div className={`rounded-xl border ${borderClass} p-4 shadow-lg backdrop-blur-md transition-all duration-300`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg border ${badgeClass}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold tracking-wide uppercase text-slate-300">
                DISPATCHER ACTION RECOMMENDATION
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${badgeClass}`}>
                {recommendation.status_badge}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5 font-medium">
              {recommendation.problem_diagnosis}
            </p>
          </div>
        </div>

        {!isOptimized && onOptimize && (
          <button
            onClick={onOptimize}
            className="flex items-center gap-1.5 self-start lg:self-center shrink-0 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Apply Optimization</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-3 items-center">
        {/* Left: Recommended Action */}
        <div className="lg:col-span-6 bg-slate-950/60 rounded-lg p-2.5 border border-slate-800/60">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Recommended Dispatch Action
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {recommendation.recommended_action}
          </p>
        </div>

        {/* Right: Quantified Impact Chips */}
        <div className="lg:col-span-6 grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/60 font-mono">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <CloudFog className="h-3 w-3 text-emerald-400" /> CO₂ Avoided
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5">
              {recommendation.expected_impact?.co2_avoided || '--'}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/60 font-mono">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Fuel className="h-3 w-3 text-cyan-400" /> Fuel Saved
            </div>
            <div className="text-xs font-bold text-cyan-400 mt-0.5">
              {recommendation.expected_impact?.fuel_saved || '--'}
            </div>
          </div>

          <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/60 font-mono">
            <div className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <IndianRupee className="h-3 w-3 text-amber-400" /> Direct Saving
            </div>
            <div className="text-xs font-bold text-amber-400 mt-0.5">
              {recommendation.expected_impact?.direct_fuel_saving || '--'}
            </div>
          </div>
        </div>
      </div>


      <div className="mt-2 text-right">
        <span className="text-[10px] text-slate-500 font-mono italic">
          * {recommendation.disclaimer}
        </span>
      </div>
    </div>
  )
}
