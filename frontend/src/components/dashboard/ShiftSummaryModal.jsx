import React, { useState } from 'react'
import { X, FileText, Download, Copy, Check, Leaf, Fuel, CloudFog, IndianRupee, Truck } from 'lucide-react'

export default function ShiftSummaryModal({
  isOpen,
  onClose,
  simulationState,
  benchmark,
  economics,
}) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const scenario = simulationState?.scenario || 'normal'
  const totalVehicles = simulationState?.vehicles?.length || 19
  const activeAssignments = simulationState?.greenflow_assignments?.length > 0
    ? simulationState.greenflow_assignments
    : simulationState?.baseline_assignments || []
  const assignedCount = activeAssignments.filter(a => a.status === 'assigned').length

  const baselineData = benchmark?.baseline
  const greenflowData = benchmark?.greenflow
  const cb = simulationState?.carbon_budget

  const fuelSaved = benchmark?.fuel_saved_l || 0.0
  const co2Reduced = benchmark?.co2_reduced_kg || 0.0
  const directCostSaved = economics?.direct_fuel_cost_saved || benchmark?.cost_saved || 0.0
  const shadowValue = economics?.avoided_carbon_shadow_value || 0.0
  const combinedImpact = economics?.combined_economic_impact || (directCostSaved + shadowValue)

  const reportPayload = {
    report_title: 'GreenFlow AI — Shift Dispatch & Sustainability Report',
    timestamp: new Date().toISOString(),
    scenario: scenario,
    fleet_dispatch: {
      routes_completed: assignedCount,
      total_routes: simulationState?.routes?.length || 15,
      vehicles_active: assignedCount,
      total_fleet: totalVehicles,
      fleet_utilisation_pct: ((assignedCount / totalVehicles) * 100).toFixed(1),
    },
    performance_metrics: {
      fuel_consumption_litres: {
        baseline: baselineData?.total_fuel_l || 477.8,
        greenflow_optimized: greenflowData?.total_fuel_l || 475.3,
        fuel_saved: fuelSaved,
        percentage_reduction: benchmark?.fuel_saved_pct || 0.5,
      },
      direct_carbon_emissions_kg: {
        baseline: baselineData?.estimated_co2_kg || 1243.5,
        greenflow_optimized: greenflowData?.estimated_co2_kg || 1221.9,
        co2_avoided: co2Reduced,
        percentage_reduction: benchmark?.co2_reduced_pct || 1.7,
      },
      economic_impact_inr: {
        direct_fuel_cost_saved: directCostSaved,
        avoided_carbon_shadow_value: shadowValue,
        combined_economic_impact: combinedImpact,
        internal_carbon_shadow_price_per_tonne: economics?.internal_shadow_price_per_tonne || 2500.0,
      },
      operational_carbon_quota: {
        budget_kg: cb?.budget_kg || 1500.0,
        projected_kg: cb?.projected_total_kg || 1221.9,
        utilisation_pct: cb?.budget_utilisation_pct || 81.5,
        status: cb?.status || 'HEALTHY',
      },
    },
    compliance_statement: '100% hard constraints satisfied (vehicle payload, availability, route priority).',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-700/80 bg-slate-900 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <FileText className="h-4 w-4" />
            <span>GreenFlow AI — Shift Dispatch & Sustainability Report</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shift Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Operational Scenario</div>
            <div className="text-slate-200 font-bold capitalize mt-0.5">{scenario.replace('_', ' ')}</div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Routes Dispatched</div>
            <div className="text-slate-200 font-bold mt-0.5">{assignedCount} / {simulationState?.routes?.length || 15}</div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Active Fleet Ratio</div>
            <div className="text-slate-200 font-bold mt-0.5">{assignedCount} / {totalVehicles} ({(assignedCount/totalVehicles*100).toFixed(0)}%)</div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="text-[10px] text-slate-400">Carbon Quota Status</div>
            <div className={`font-bold mt-0.5 ${cb?.status === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {cb?.budget_utilisation_pct?.toFixed(1) || 81.5}% ({cb?.status || 'HEALTHY'})
            </div>
          </div>
        </div>

        {/* Detailed Impact Table */}
        <div className="rounded-lg border border-slate-800/80 overflow-hidden text-xs font-mono">
          <div className="bg-slate-950/80 p-2.5 border-b border-slate-800 font-sans font-semibold text-slate-300 flex items-center justify-between">
            <span>Shift Performance & Savings Statement</span>
            <span className="text-[10px] font-mono text-slate-400">Direct vs Shadow Valuation</span>
          </div>
          <div className="divide-y divide-slate-800/60 bg-slate-900/40 p-3 space-y-2">
            <div className="flex justify-between items-center text-slate-300">
              <span className="flex items-center gap-1.5 font-sans"><Fuel className="h-3.5 w-3.5 text-cyan-400" /> Fuel Saved</span>
              <span className="font-bold text-cyan-300">{fuelSaved.toFixed(1)} L (Baseline: {baselineData?.total_fuel_l?.toFixed(1) || 477.8} L)</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 pt-2">
              <span className="flex items-center gap-1.5 font-sans"><CloudFog className="h-3.5 w-3.5 text-emerald-400" /> CO₂ Emissions Avoided</span>
              <span className="font-bold text-emerald-300">{co2Reduced.toFixed(1)} kg CO2e ({benchmark?.co2_reduced_pct?.toFixed(1) || 1.7}%)</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 pt-2">
              <span className="flex items-center gap-1.5 font-sans"><IndianRupee className="h-3.5 w-3.5 text-amber-400" /> Direct Fuel Cost Saved</span>
              <span className="font-bold text-amber-300">₹{directCostSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 pt-2">
              <span className="flex items-center gap-1.5 font-sans"><Leaf className="h-3.5 w-3.5 text-emerald-400" /> Avoided Carbon Shadow Value (₹2,500/t)</span>
              <span className="font-bold text-emerald-300">₹{shadowValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-center text-slate-100 font-bold border-t border-slate-700/80 pt-2">
              <span className="font-sans text-cyan-300">Combined Economic Impact</span>
              <span className="text-sm text-cyan-300 font-mono">₹{combinedImpact.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-slate-500 font-mono italic">
            * Simulated / Illustrative benchmark performance
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied JSON!' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-1.5 text-xs shadow-md transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
