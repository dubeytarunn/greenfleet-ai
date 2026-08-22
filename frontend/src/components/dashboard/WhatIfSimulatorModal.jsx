import React, { useState } from 'react'
import { X, Sliders, Play, TrendingUp, TrendingDown, ArrowRight, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react'
import api from '../../services/api.js'

export default function WhatIfSimulatorModal({ isOpen, onClose }) {
  const [budgetKg, setBudgetKg] = useState(1500)
  const [trafficFactor, setTrafficFactor] = useState(1.0)
  const [riskLambda, setRiskLambda] = useState(0.5)
  const [dieselPrice, setDieselPrice] = useState(94)

  const [loading, setLoading] = useState(false)
  const [projection, setProjection] = useState(null)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSimulate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.simulateWhatIf({
        carbon_budget_kg: Number(budgetKg),
        traffic_factor_multiplier: Number(trafficFactor),
        risk_aversion_lambda: Number(riskLambda),
        diesel_price_per_l: Number(dieselPrice),
      })
      setProjection(res)
    } catch (err) {
      setError(err.message || 'What-If simulation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Sliders className="h-4 w-4" />
            <span>Interactive What-If Dispatch Simulator</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 4 Interactive Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80 text-xs">
          {/* Carbon Budget Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Operational Carbon Quota</span>
              <span className="text-emerald-400 font-mono font-bold">{budgetKg} kg</span>
            </div>
            <input
              type="range"
              min="800"
              max="2500"
              step="50"
              value={budgetKg}
              onChange={(e) => setBudgetKg(e.target.value)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>800 kg (Tight)</span>
              <span>1500 kg (Normal)</span>
              <span>2500 kg (Relaxed)</span>
            </div>
          </div>

          {/* Traffic Congestion Multiplier */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Traffic Congestion Multiplier</span>
              <span className="text-amber-400 font-mono font-bold">{trafficFactor}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="2.0"
              step="0.1"
              value={trafficFactor}
              onChange={(e) => setTrafficFactor(e.target.value)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.8x (Free flow)</span>
              <span>1.0x (Baseline)</span>
              <span>2.0x (Severe Gridlock)</span>
            </div>
          </div>

          {/* Risk Aversion Lambda */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Prediction Risk Aversion (λ)</span>
              <span className="text-cyan-400 font-mono font-bold">{riskLambda}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={riskLambda}
              onChange={(e) => setRiskLambda(e.target.value)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0.0 (Risk Neutral)</span>
              <span>0.5 (Default)</span>
              <span>1.5 (High Variance Penalty)</span>
            </div>
          </div>

          {/* Diesel Fuel Price */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300 font-medium">
              <span>Fuel Price Assumption</span>
              <span className="text-rose-400 font-mono font-bold">₹{dieselPrice} / L</span>
            </div>
            <input
              type="range"
              min="70"
              max="130"
              step="1"
              value={dieselPrice}
              onChange={(e) => setDieselPrice(e.target.value)}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>₹70/L (Low)</span>
              <span>₹94/L (Standard)</span>
              <span>₹130/L (Surge)</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 italic">
            * Non-mutating simulation: does not alter active dispatch state
          </span>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2 text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Simulating QUBO Allocation...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Simulate What-If Plan</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded border border-rose-800">
            {error}
          </div>
        )}

        {/* Projection Results */}
        {projection && (
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-200">
              {projection.summary_verdict}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-left">
                    <th className="py-1.5 px-2">Metric</th>
                    <th className="py-1.5 px-2">Current Plan</th>
                    <th className="py-1.5 px-2">What-If Projected</th>
                    <th className="py-1.5 px-2">Delta Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-300">Fuel Consumption</td>
                    <td className="py-1.5 px-2">{projection.current_fuel_l.toFixed(1)} L</td>
                    <td className="py-1.5 px-2 text-cyan-300 font-bold">{projection.projected_fuel_l.toFixed(1)} L</td>
                    <td className={`py-1.5 px-2 ${projection.fuel_delta_l <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {projection.fuel_delta_l > 0 ? `+${projection.fuel_delta_l.toFixed(1)} L` : `${projection.fuel_delta_l.toFixed(1)} L`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-300">Direct CO₂ Emissions</td>
                    <td className="py-1.5 px-2">{projection.current_co2_kg.toFixed(1)} kg</td>
                    <td className="py-1.5 px-2 text-emerald-300 font-bold">{projection.projected_co2_kg.toFixed(1)} kg</td>
                    <td className={`py-1.5 px-2 ${projection.co2_delta_kg <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {projection.co2_delta_kg > 0 ? `+${projection.co2_delta_kg.toFixed(1)} kg` : `${projection.co2_delta_kg.toFixed(1)} kg`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-300">Fuel Spend</td>
                    <td className="py-1.5 px-2">₹{projection.current_fuel_cost.toLocaleString()}</td>
                    <td className="py-1.5 px-2 text-amber-300 font-bold">₹{projection.projected_fuel_cost.toLocaleString()}</td>
                    <td className={`py-1.5 px-2 ${projection.cost_delta <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {projection.cost_delta > 0 ? `+₹${projection.cost_delta.toLocaleString()}` : `₹${projection.cost_delta.toLocaleString()}`}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-300">Carbon Quota Utilisation</td>
                    <td className="py-1.5 px-2">{projection.current_carbon_utilisation_pct.toFixed(1)}%</td>
                    <td className="py-1.5 px-2 font-bold text-slate-200">
                      {projection.projected_carbon_utilisation_pct.toFixed(1)}% ({projection.projected_carbon_status})
                    </td>
                    <td className="py-1.5 px-2 text-slate-400">
                      {projection.reassigned_routes_count} routes reassigned
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
