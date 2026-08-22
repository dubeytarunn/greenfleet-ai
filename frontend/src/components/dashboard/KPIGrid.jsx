import React from 'react'
import { Truck, Fuel, CloudFog, Activity, TrendingDown } from 'lucide-react'
import MetricCard from '../common/MetricCard.jsx'

export default function KPIGrid({ benchmark, state }) {
  const activeCount = state?.vehicles?.filter(v => v.available)?.length || 18
  const totalVehicles = state?.vehicles_count || 20
  const totalRoutes = state?.routes_count || 12

  const fuelVal = benchmark?.greenflow?.total_fuel_l || 397.9
  const fuelSaved = benchmark?.fuel_saved_l || 87.0
  const fuelPct = benchmark?.fuel_saved_pct || 17.9

  const co2Val = ((benchmark?.greenflow?.estimated_co2_kg || 1023.7) / 1000).toFixed(1)
  const co2ReducedKg = benchmark?.co2_reduced_kg || 274.4
  const co2Pct = benchmark?.co2_reduced_pct || 21.1

  const utilisation = benchmark?.greenflow?.fleet_utilisation_pct || 88.9
  const costSaved = benchmark?.cost_saved || 332.6

  const kpiData = [
    {
      id: 'active-vehicles',
      label: 'Active Fleet Units',
      value: `${activeCount}`,
      unit: `/ ${totalVehicles}`,
      icon: Truck,
      subtitle: `${totalRoutes} routes assigned`,
      accent: 'emerald',
    },
    {
      id: 'fuel-consumption',
      label: 'Fuel Consumption',
      value: `${fuelVal.toLocaleString()}`,
      unit: 'L',
      icon: Fuel,
      trend: `-${fuelPct}%`,
      trendPositive: true,
      subtitle: `-${fuelSaved} L vs baseline`,
      accent: 'cyan',
    },
    {
      id: 'estimated-co2',
      label: 'Estimated CO₂',
      value: `${co2Val}`,
      unit: 't',
      icon: CloudFog,
      trend: `-${co2Pct}%`,
      trendPositive: true,
      subtitle: `-${co2ReducedKg} kg reduction`,
      accent: 'emerald',
    },
    {
      id: 'fleet-utilisation',
      label: 'Fleet Utilisation',
      value: `${utilisation}%`,
      icon: Activity,
      trend: '+18.5%',
      trendPositive: true,
      subtitle: 'optimal load balance',
      accent: 'blue',
    },
    {
      id: 'cost-saved',
      label: 'OpEx Cost Saved',
      value: `$${costSaved.toLocaleString()}`,
      unit: '',
      icon: TrendingDown,
      trend: `-${benchmark?.cost_saved_pct || 13.4}%`,
      trendPositive: true,
      subtitle: 'operational delta',
      accent: 'amber',
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
