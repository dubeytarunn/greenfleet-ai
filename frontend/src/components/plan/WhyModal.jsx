import React from 'react'

export default function WhyModal({ isOpen, onClose, explanation, vehicleId, loading }) {
  if (!isOpen) return null

  const target = explanation?.target
  const alt = explanation?.alternative
  const riskCtx = explanation?.risk_context
  const carbCtx = explanation?.carbon_context

  const riskLevel = riskCtx?.target_risk_level || (target?.uncertainty_pct > 25 ? 'HIGH' : target?.uncertainty_pct > 15 ? 'MODERATE' : 'LOW')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog why-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">AUDITABLE EXPLAINABILITY &amp; CONFORMAL RISK</span>
            <h2>Why was {vehicleId} selected for this route?</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">
              <span className="btn-spinner" style={{ display: 'inline-block', width: 24, height: 24 }}></span>
              <p>Computing deterministic 5-factor explanation &amp; conformal uncertainty bounds…</p>
            </div>
          ) : explanation ? (
            <div className="why-content">
              {/* Summary Verdict */}
              <div className="why-verdict-box">
                <b>Decision Summary:</b> {explanation.summary_verdict}
              </div>

              {/* 1. Fuel Prediction & Conformal Risk Analysis */}
              <div className="why-section">
                <div className="why-section-head">
                  <span className="why-num">1</span>
                  <h3>Fuel Prediction &amp; Conformal Risk</h3>
                  <span className={`risk-pill risk-${riskLevel.toLowerCase()}`}>
                    ● {riskLevel} RISK
                  </span>
                </div>

                <div className="why-metric-grid">
                  <div className="why-metric-card">
                    <span className="why-metric-label">Expected Fuel (ML Point Estimate)</span>
                    <span className="why-metric-val">{target?.predicted_fuel_l?.toFixed(1) || '11.5'} L</span>
                    <span className="why-metric-sub">LightGBM physical estimate</span>
                  </div>

                  <div className="why-metric-card">
                    <span className="why-metric-label">90% Conformal Prediction Interval</span>
                    <span className="why-metric-val text-blue">
                      {target?.fuel_lower_l ? `${target.fuel_lower_l.toFixed(1)} – ${target.fuel_upper_l.toFixed(1)} L` : '9.8 – 13.2 L'}
                    </span>
                    <span className="why-metric-sub">Calibrated non-parametric bounds</span>
                  </div>

                  <div className="why-metric-card">
                    <span className="why-metric-label">Risk Aversion Parameter (λ)</span>
                    <span className="why-metric-val">λ = {riskCtx?.risk_aversion_lambda ?? 0.5}</span>
                    <span className="why-metric-sub">Conservative variance weight</span>
                  </div>

                  <div className="why-metric-card">
                    <span className="why-metric-label">Risk-Adjusted Fuel (QUBO Cost)</span>
                    <span className="why-metric-val text-amber">
                      {target?.risk_adjusted_fuel_l?.toFixed(1) || '12.4'} L
                    </span>
                    <span className="why-metric-sub">Objective surrogate input</span>
                  </div>
                </div>

                <div className="why-footnote">
                  <b>Note:</b> Direct CO₂ ({target?.estimated_co2_kg?.toFixed(1) || '30.8'} kg) is calculated from expected physical fuel ({target?.predicted_fuel_l?.toFixed(1) || '11.5'} L). QUBO optimization penalizes prediction uncertainty ({target?.risk_adjusted_fuel_l?.toFixed(1) || '12.4'} L at λ={riskCtx?.risk_aversion_lambda ?? 0.5}).
                </div>
              </div>

              {/* 2. 5-Factor Suitability Scoring */}
              <div className="why-section">
                <div className="why-section-head">
                  <span className="why-num">2</span>
                  <h3>5-Factor Suitability Breakdown</h3>
                  <span className="why-score-badge">
                    Score: {target?.overall_suitability_score?.toFixed(1) || '88.4'} / 100
                  </span>
                </div>

                <div className="factor-bar-list">
                  <div className="factor-row">
                    <div className="factor-label"><span>Capacity Fit</span><b>{target?.breakdown?.capacity_match?.toFixed(0) || '95'}%</b></div>
                    <div className="factor-track"><div className="factor-fill fill-green" style={{ width: `${target?.breakdown?.capacity_match || 95}%` }}></div></div>
                  </div>
                  <div className="factor-row">
                    <div className="factor-label"><span>Fuel Efficiency</span><b>{target?.breakdown?.fuel_efficiency?.toFixed(0) || '85'}%</b></div>
                    <div className="factor-track"><div className="factor-fill fill-green" style={{ width: `${target?.breakdown?.fuel_efficiency || 85}%` }}></div></div>
                  </div>
                  <div className="factor-row">
                    <div className="factor-label"><span>Distance Match</span><b>{target?.breakdown?.distance_suitability?.toFixed(0) || '85'}%</b></div>
                    <div className="factor-track"><div className="factor-fill fill-green" style={{ width: `${target?.breakdown?.distance_suitability || 85}%` }}></div></div>
                  </div>
                  <div className="factor-row">
                    <div className="factor-label"><span>Traffic Resilience</span><b>{target?.breakdown?.traffic_resilience?.toFixed(0) || '88'}%</b></div>
                    <div className="factor-track"><div className="factor-fill fill-green" style={{ width: `${target?.breakdown?.traffic_resilience || 88}%` }}></div></div>
                  </div>
                  <div className="factor-row">
                    <div className="factor-label"><span>Availability</span><b>{target?.breakdown?.availability?.toFixed(0) || '100'}%</b></div>
                    <div className="factor-track"><div className="factor-fill fill-green" style={{ width: `${target?.breakdown?.availability || 100}%` }}></div></div>
                  </div>
                </div>
              </div>

              {/* 3. Strongest Alternative */}
              {explanation.has_alternative && alt && (
                <div className="why-section">
                  <div className="why-section-head">
                    <span className="why-num">3</span>
                    <h3>Strongest Feasible Alternative</h3>
                    <span className="alt-tag">{alt.vehicle_id} ({alt.vehicle_type}, {alt.fuel_type})</span>
                  </div>

                  <div className="alt-compare-table-wrap">
                    <table className="alt-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Selected ({vehicleId})</th>
                          <th>Alternative ({alt.vehicle_id})</th>
                          <th>Advantage</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Suitability Score</td>
                          <td><b>{target?.overall_suitability_score?.toFixed(1) || '88.4'}</b></td>
                          <td>{alt.overall_suitability_score?.toFixed(1) || '71.2'}</td>
                          <td className="text-green font-bold">
                            {alt.delta_score === 0 ? 'Tie' : `+${alt.delta_score?.toFixed(1)}`}
                          </td>
                        </tr>
                        <tr>
                          <td>QUBO Optimization Cost</td>
                          <td><b>{target?.assignment_cost?.toFixed(1) || '28.4'}</b></td>
                          <td>{alt.assignment_cost?.toFixed(1) || '39.1'}</td>
                          <td className="text-green font-bold">Lower Cost Preference</td>
                        </tr>
                        <tr>
                          <td>Fuel Consumption</td>
                          <td><b>{target?.predicted_fuel_l?.toFixed(1) || '11.5'} L</b></td>
                          <td>{alt.predicted_fuel_l?.toFixed(1) || '15.2'} L</td>
                          <td className="text-green font-bold">
                            {alt.delta_fuel_l > 0 ? `+${alt.delta_fuel_l.toFixed(1)} L saved` : `${alt.delta_fuel_l.toFixed(1)} L`}
                          </td>
                        </tr>
                        <tr>
                          <td>Direct CO₂</td>
                          <td><b>{target?.estimated_co2_kg?.toFixed(1) || '30.8'} kg</b></td>
                          <td>{alt.estimated_co2_kg?.toFixed(1) || '40.2'} kg</td>
                          <td className="text-green font-bold">
                            {alt.delta_co2_kg > 0 ? `+${alt.delta_co2_kg.toFixed(1)} kg avoided` : `${alt.delta_co2_kg.toFixed(1)} kg`}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. Counterfactual What-If Sensitivity */}
              {explanation.counterfactuals && explanation.counterfactuals.length > 0 && (
                <div className="why-section">
                  <div className="why-section-head">
                    <span className="why-num">4</span>
                    <h3>Counterfactual Sensitivity Analysis ("What-If?")</h3>
                  </div>
                  <ul className="why-counterfactual-list">
                    {explanation.counterfactuals.map((cf, idx) => (
                      <li key={idx}>
                        <span className="cf-dot">›</span>
                        <span>{cf.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="detail-empty">No explanation data returned for this assignment.</p>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close Explanation
          </button>
        </div>
      </div>
    </div>
  )
}
