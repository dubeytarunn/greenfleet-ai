import React, { useState } from 'react'
import api from '../../services/api.js'

export default function WhatIfModal({ isOpen, onClose }) {
  const [budgetKg, setBudgetKg] = useState(1500)
  const [trafficFactor, setTrafficFactor] = useState(1.0)
  const [riskLambda, setRiskLambda] = useState(0.5)
  const [dieselPrice, setDieselPrice] = useState(95)

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">DECISION SUPPORT PLANNING</span>
            <h2>Interactive What-If Dispatch Simulator</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-inset)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-soft)' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Carbon Quota</span>
                <b style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{budgetKg} kg</b>
              </div>
              <input
                type="range" min="800" max="2500" step="50" value={budgetKg}
                onChange={(e) => setBudgetKg(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent-green)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Traffic Factor</span>
                <b style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{trafficFactor}x</b>
              </div>
              <input
                type="range" min="0.8" max="2.0" step="0.1" value={trafficFactor}
                onChange={(e) => setTrafficFactor(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Risk Aversion (λ)</span>
                <b style={{ color: 'var(--geotab-blue)', fontFamily: 'var(--font-mono)' }}>{riskLambda}</b>
              </div>
              <input
                type="range" min="0.0" max="1.5" step="0.1" value={riskLambda}
                onChange={(e) => setRiskLambda(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--geotab-blue)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fuel Price</span>
                <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{dieselPrice} / L</b>
              </div>
              <input
                type="range" min="70" max="130" step="1" value={dieselPrice}
                onChange={(e) => setDieselPrice(e.target.value)}
                style={{ width: '100%', accentColor: 'var(--action-primary)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              * Isolated simulation — active dispatch plan is preserved
            </span>
            <button
              type="button"
              className={`btn btn-primary ${loading ? 'is-running' : ''}`}
              onClick={handleSimulate}
              disabled={loading}
            >
              <span className="btn-label">Simulate What-If Plan</span>
              <span className="btn-spinner" aria-hidden="true"></span>
            </button>
          </div>

          {error && (
            <div style={{ color: 'var(--accent-red)', background: 'var(--accent-red-soft)', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {projection && (
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>
                {projection.summary_verdict}
              </p>

              <table className="data-table" style={{ width: '100%', fontSize: '11.5px' }}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Current Plan</th>
                    <th>What-If Projected</th>
                    <th>Delta Shift</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>Fuel Consumption</b></td>
                    <td className="mono">{projection.current_fuel_l.toFixed(1)} L</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--geotab-blue)' }}>{projection.projected_fuel_l.toFixed(1)} L</td>
                    <td className="mono" style={{ color: projection.fuel_delta_l <= 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {projection.fuel_delta_l > 0 ? `+${projection.fuel_delta_l.toFixed(1)} L` : `${projection.fuel_delta_l.toFixed(1)} L`}
                    </td>
                  </tr>
                  <tr>
                    <td><b>Direct CO₂</b></td>
                    <td className="mono">{projection.current_co2_kg.toFixed(1)} kg</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-green)' }}>{projection.projected_co2_kg.toFixed(1)} kg</td>
                    <td className="mono" style={{ color: projection.co2_delta_kg <= 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {projection.co2_delta_kg > 0 ? `+${projection.co2_delta_kg.toFixed(1)} kg` : `${projection.co2_delta_kg.toFixed(1)} kg`}
                    </td>
                  </tr>
                  <tr>
                    <td><b>Operating Cost</b></td>
                    <td className="mono">₹{projection.current_fuel_cost.toLocaleString()}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{projection.projected_fuel_cost.toLocaleString()}</td>
                    <td className="mono" style={{ color: projection.cost_delta <= 0 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                      {projection.cost_delta > 0 ? `+₹${projection.cost_delta.toLocaleString()}` : `₹${projection.cost_delta.toLocaleString()}`}
                    </td>
                  </tr>
                  <tr>
                    <td><b>Carbon Quota Utilisation</b></td>
                    <td className="mono">{projection.current_carbon_utilisation_pct.toFixed(1)}%</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{projection.projected_carbon_utilisation_pct.toFixed(1)}% ({projection.projected_carbon_status})</td>
                    <td className="mono" style={{ color: 'var(--text-tertiary)' }}>{projection.reassigned_routes_count} routes reassigned</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
