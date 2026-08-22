import React, { useState, useEffect } from 'react'
import api from '../../services/api.js'

export default function ScenarioModal({ isOpen, onClose }) {
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">STRATEGIC SCENARIO COMPARISON</span>
            <h2>Multi-Scenario Planning Matrix</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <span className="btn-spinner" style={{ display: 'inline-block', width: 24, height: 24 }}></span>
              <p>Simulating 4 canonical scenarios side-by-side…</p>
            </div>
          ) : error ? (
            <div style={{ color: 'var(--accent-red)', background: 'var(--accent-red-soft)', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
              {error}
            </div>
          ) : matrixData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="table-scroll" style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th style={{ textAlign: 'right' }}>Fuel (L)</th>
                      <th style={{ textAlign: 'right' }}>CO₂ (kg)</th>
                      <th style={{ textAlign: 'right' }}>Operating Cost</th>
                      <th style={{ textAlign: 'right' }}>Quota (kg)</th>
                      <th style={{ textAlign: 'right' }}>Utilisation</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right' }}>Fleet Util</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.scenarios.map((s) => {
                      const isActive = s.scenario_key === matrixData.active_scenario_key
                      return (
                        <tr key={s.scenario_key} className={isActive ? 'selected' : ''}>
                          <td>
                            <b>{s.scenario_name}</b>
                            {isActive && <span className="tag" style={{ marginLeft: '6px', fontSize: '9px', padding: '2px 6px' }}>Active</span>}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{s.total_fuel_l.toFixed(1)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--accent-green)', fontWeight: 600 }}>{s.total_co2_kg.toFixed(1)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>₹{s.direct_fuel_cost.toLocaleString()}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>{s.carbon_quota_kg.toFixed(0)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{s.quota_utilisation_pct.toFixed(1)}%</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-badge status-${s.carbon_status.toLowerCase()}`}>
                              {s.carbon_status}
                            </span>
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>{s.fleet_utilisation_pct.toFixed(0)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'right' }}>
                * {matrixData.disclaimer}
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
