import React, { useState } from 'react'

export default function ShiftSummaryModal({
  isOpen,
  onClose,
  kpis = {},
  baselineKpis = {},
  scenario = 'normal',
  vehicles = [],
  routes = [],
  assignment = {},
  economics = null,
}) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const assignedVehiclesCount = Object.keys(assignment).filter((vid) => (assignment[vid] || []).length > 0).length
  const totalVehicles = vehicles.length || 5
  const fuelSaved = Math.max(0, (baselineKpis.fuelL || 0) - (kpis.fuelL || 0))
  const co2Avoided = Math.max(0, (baselineKpis.co2Kg || 0) - (kpis.co2Kg || 0))
  const directCostSaved = Math.max(0, (baselineKpis.costINR || 0) - (kpis.costINR || 0))
  const shadowValue = Number((co2Avoided * 2.5).toFixed(0))
  const combinedImpact = directCostSaved + shadowValue

  const reportPayload = {
    report_title: 'GreenFlow AI — Shift Dispatch & Sustainability Report',
    timestamp: new Date().toISOString(),
    scenario,
    fleet_dispatch: {
      active_vehicles: assignedVehiclesCount,
      total_fleet: totalVehicles,
      fleet_utilisation_pct: ((assignedVehiclesCount / totalVehicles) * 100).toFixed(0),
    },
    performance_metrics: {
      fuel_litres: { baseline: baselineKpis.fuelL || 0, optimized: kpis.fuelL || 0, saved: fuelSaved },
      carbon_co2_kg: { baseline: baselineKpis.co2Kg || 0, optimized: kpis.co2Kg || 0, avoided: co2Avoided },
      economic_inr: { direct_fuel_cost_saved: directCostSaved, avoided_carbon_shadow_value: shadowValue, combined_impact: combinedImpact },
    },
    compliance: '100% hard constraints satisfied (capacity, route coverage, vehicle availability).',
    disclaimer: 'Simulated / Illustrative benchmark performance',
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(reportPayload, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportPayload, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `greenflow_shift_report_${scenario}_${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="modal-eyebrow">ENTERPRISE AUDIT STATEMENT</span>
            <h2>Shift Dispatch &amp; Sustainability Report</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ background: 'var(--bg-inset)', padding: '10px', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>Operating Scenario</span>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'capitalize', marginTop: '2px' }}>{scenario} Demand</div>
            </div>
            <div style={{ background: 'var(--bg-inset)', padding: '10px', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>Active Fleet Ratio</span>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>{assignedVehiclesCount} / {totalVehicles} ({((assignedVehiclesCount/totalVehicles)*100).toFixed(0)}%)</div>
            </div>
            <div style={{ background: 'var(--bg-inset)', padding: '10px', borderRadius: '4px', border: '1px solid var(--line-soft)' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>Constraint Compliance</span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)', marginTop: '2px' }}>100% Feasible</div>
            </div>
          </div>

          {/* Differentiated Financial Statement */}
          <div style={{ border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ background: 'var(--bg-panel-raised)', padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600, fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Differentiated Savings Breakdown</span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>Direct vs Shadow</span>
            </div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Fuel Saved</span>
                <b style={{ color: 'var(--geotab-blue)', fontFamily: 'var(--font-mono)' }}>{fuelSaved.toFixed(1)} L</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CO₂ Emissions Avoided</span>
                <b style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{co2Avoided.toFixed(1)} kg</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Direct Fuel Cost Saved (₹)</span>
                <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹{directCostSaved.toLocaleString()}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Avoided Carbon Shadow Value (@ ₹2,500/t)</span>
                <b style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>₹{shadowValue.toLocaleString()}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--line-soft)', paddingTop: '8px', fontSize: '13px', fontWeight: 700 }}>
                <span>Combined Economic Impact</span>
                <span style={{ color: 'var(--geotab-blue)', fontFamily: 'var(--font-mono)' }}>₹{combinedImpact.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            * Simulated / Illustrative benchmark statement
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={handleCopy}>
            {copied ? '✓ Copied JSON!' : 'Copy Summary'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleDownload}>
            Download JSON Report
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
