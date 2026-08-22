import React from 'react'
import { Truck, Fuel, CloudFog, TrendingDown, Leaf, IndianRupee } from 'lucide-react'
import MetricCard from '../common/MetricCard.jsx'

export default function KPIGrid({
  benchmark = null,
  simulationState = null,
  carbonBudget = null,
  isOptimized = false,
  economics = null,
}) {
  const totalVehicles = simulationState?.vehicles?.length || 0
  const activeAssignments = isOptimized
    ? simulationState?.greenflow_assignments || []
    : simulationState?.baseline_assignments || []
  const assignedCount = activeAssignments.length
  const standbyCount = Math.max(0, totalVehicles - assignedCount)

  const baselineData = benchmark?.baseline
  const greenflowData = benchmark?.greenflow
  const cb = carbonBudget || simulationState?.carbon_budget

  // Direct fuel cost calculation
  const directCostSaved = economics?.direct_fuel_cost_saved || benchmark?.cost_saved || 0.0
  const baselineCost = economics?.baseline_fuel_cost || baselineData?.total_operating_cost || 0.0
  const optCost = economics?.greenflow_fuel_cost || greenflowData?.total_operating_cost || 0.0

  const kpiData = [
    {
      id: 'fuel-saved',
      label: isOptimized ? 'Fuel Saved' : 'Fuel Consumption',
      value: isOptimized && benchmark
        ? `${benchmark.fuel_saved_l.toFixed(1)}`
        : (baselineData?.total_fuel_l?.toFixed(1) || '--'),
      unit: 'L',
      icon: Fuel,
      trend: isOptimized && benchmark ? `-${benchmark.fuel_saved_pct.toFixed(1)}%` : null,
      trendPositive: true,
      subtitle: isOptimized && baselineData
        ? `Baseline: ${baselineData.total_fuel_l.toFixed(1)} L`
        : 'Uncoordinated baseline',
      accent: 'cyan',
    },
    {
      id: 'co2-reduced',
      label: isOptimized ? 'CO₂ Reduced' : 'Estimated CO₂',
      value: isOptimized && benchmark
        ? `${benchmark.co2_reduced_kg.toFixed(1)}`
        : baselineData
        ? `${baselineData.estimated_co2_kg.toFixed(1)}`
        : '--',
      unit: 'kg',
      icon: CloudFog,
      trend: isOptimized && benchmark ? `-${benchmark.co2_reduced_pct.toFixed(1)}%` : null,
      trendPositive: true,
      subtitle: isOptimized && baselineData
        ? `Baseline: ${baselineData.estimated_co2_kg.toFixed(1)} kg`
        : 'Direct emissions',
      accent: 'emerald',
    },
    {
      id: 'cost-saved',
      label: isOptimized ? 'Cost Saved' : 'Direct Fuel Cost',
      value: isOptimized && directCostSaved > 0
        ? `₹${directCostSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : baselineCost > 0
        ? `₹${baselineCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '--',
      unit: isOptimized ? '/ shift' : '',
      icon: IndianRupee,
      trend: isOptimized && benchmark ? `-${benchmark.cost_saved_pct.toFixed(1)}%` : null,
      trendPositive: true,
      subtitle: isOptimized && baselineCost > 0
        ? `Baseline: ₹${baselineCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : 'Direct fuel spend',
      accent: 'amber',
    },
    {
      id: 'carbon-quota',
      label: 'Carbon Quota',
      value: cb
        ? `${cb.budget_utilisation_pct.toFixed(1)}%`
        : '--',
      unit: cb ? `(${cb.status})` : '',
      icon: Leaf,
      trend: cb ? `w_co2=${cb.dynamic_co2_penalty}x` : null,
      trendPositive: cb ? cb.status === 'HEALTHY' || cb.status === 'WARNING' : true,
      subtitle: cb
        ? `${cb.projected_total_kg.toFixed(0)} / ${cb.budget_kg.toFixed(0)} kg quota`
        : 'Quota tracking inactive',
      accent: cb?.status === 'OVER_BUDGET' ? 'rose' : cb?.status === 'CRITICAL' ? 'amber' : 'emerald',
    },
    {
      id: 'active-vehicles',
      label: 'Fleet Dispatch',
      value: `${assignedCount}`,
      unit: `/ ${totalVehicles} active`,
      icon: Truck,
      subtitle: `${standbyCount} standby in depot`,
      accent: 'emerald',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {kpiData.map((kpi) => (
        <MetricCard
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
          unit={kpi.unit}
          icon={kpi.icon}
          trend={kpi.trend}
          trendPositive={kpi.trendPositive}
          subtitle={kpi.subtitle}
          accent={kpi.accent}
        />
      ))}
    </div>
  )
}
