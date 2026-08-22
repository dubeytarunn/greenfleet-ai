import React, { useState, useEffect } from 'react'
import { X, Layers, RefreshCw, CheckCircle2 } from 'lucide-react'
import api from '../../services/api.js'

export default function ScenarioMatrixModal({ isOpen, onClose }) {
  const [matrixData, setMatrixData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchMatrix()
    }
  }, [isOpen])

  const fetchMatrix = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getScenarioMatrix()
      setMatrixData(res)
    } catch (err) {
      setError(err.message || 'Failed to load scenario matrix')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Layers className="h-4 w-4" />
            <span>Multi-Scenario Comparative Planning Matrix</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Evaluating optimization across 4 standard operating scenarios...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded border border-rose-800">
            {error}
          </div>
        ) : matrixData ? (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-800/80">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-left">
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3 text-right">Fuel (L)</th>
                    <th className="py-2 px-3 text-right">CO₂ (kg)</th>
                    <th className="py-2 px-3 text-right">Direct Cost</th>
                    <th className="py-2 px-3 text-right">Quota (kg)</th>
                    <th className="py-2 px-3 text-right">Utilisation</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-right">Fleet Util</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {matrixData.scenarios.map((s) => {
                    const isActive = s.scenario_key === matrixData.active_scenario_key
                    const isHealthy = s.carbon_status === 'HEALTHY'
                    const isWarning = s.carbon_status === 'WARNING'
                    const isCritical = s.carbon_status === 'CRITICAL' || s.carbon_status === 'OVER_BUDGET'

                    const statusBadgeClass = isHealthy
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isWarning
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'

                    return (
                      <tr
                        key={s.scenario_key}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isActive ? 'bg-emerald-950/20 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200 flex items-center gap-1.5">
                          {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                          <span>{s.scenario_name}</span>
                          {isActive && (
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-cyan-300">{s.total_fuel_l.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-300">{s.total_co2_kg.toFixed(1)}</td>
                        <td className="py-2.5 px-3 text-right text-amber-300 font-bold">
                          ₹{s.direct_fuel_cost.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{s.carbon_quota_kg.toFixed(0)}</td>
                        <td className="py-2.5 px-3 text-right font-bold">{s.quota_utilisation_pct.toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${statusBadgeClass}`}>
                            {s.carbon_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{s.fleet_utilisation_pct.toFixed(0)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-500 font-mono italic text-right">
              * {matrixData.disclaimer}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
