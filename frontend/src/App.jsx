import React from 'react'
import Header from './components/common/Header.jsx'
import Dashboard from './components/dashboard/Dashboard.jsx'

// ---------------------------------------------------------------------------
// Adapters: backend VehicleModel/RouteModel/AssignmentModel -> the shape the
// existing UI components already render (id/type/fuel/capacity/efficiency/
// co2Factor for vehicles; id/area/distanceKm/demand/traffic/priority for
// routes). Keeping this mapping at the App.jsx boundary means no downstream
// component needs to change even though the real fields differ.
// ---------------------------------------------------------------------------
const CO2_FACTORS_BY_FUEL = {
  Diesel: 2.68,
  Petrol: 2.31,
  Hybrid: 1.7325, // DEFRA petrol factor x0.75 powertrain efficiency
  CNG: 1.95,
  Electric: 0.45,
  EV: 0.45,
}

function trafficLabel(trafficFactor) {
  if (trafficFactor <= 1.12) return 'Low'
  if (trafficFactor <= 1.22) return 'Medium'
  return 'High'
}

function priorityLabel(priority) {
  if (priority <= 1) return 'Standard'
  if (priority === 2) return 'High'
  return 'Critical'
}

function mapVehicle(v) {
  return {
    id: v.vehicle_id,
    driver: `Driver ${(v.vehicle_id.match(/\d+/) || ['000'])[0]}`,
    type: v.vehicle_type,
    fuel: v.fuel_type,
    capacity: v.max_payload_kg,
    efficiency: v.fuel_efficiency_kmpl || 10,
    co2Factor: CO2_FACTORS_BY_FUEL[v.fuel_type] || 2.5,
    availableNormally: v.available,
  }
}

function mapRoute(r) {
  return {
    id: r.route_id,
    area: r.destination || r.origin,
    distanceKm: r.distance_km,
    demand: r.required_payload_kg,
    traffic: trafficLabel(r.traffic_factor),
    priority: priorityLabel(r.priority),
  }
}

function mapAssignments(list = []) {
  const map = {}
  const details = {}
  list.forEach((a) => {
    if (!map[a.vehicle_id]) map[a.vehicle_id] = []
    map[a.vehicle_id].push(a.route_id)
    details[`${a.vehicle_id}:${a.route_id}`] = {
      fuelL: a.predicted_fuel_l || 0,
      co2Kg: a.estimated_co2_kg || 0,
      costINR: a.operating_cost || 0,
    }
  })
  return { map, details }
}

// Backend has no sub-stop/order model — synthesize a couple of display-only
// stops per route so the Orders sub-tab still has something to show.
function deriveOrders(routes) {
  const orders = []
  routes.forEach((r) => {
    const stopCount = 2 + (r.id.charCodeAt(r.id.length - 1) % 2)
    for (let i = 1; i <= stopCount; i++) {
      orders.push({
        id: `ORD-${r.id}-${i}`,
        route: r.id,
        loc: `${r.area} Stop ${i}`,
        boxes: Math.max(1, Math.round(r.demand / (stopCount * 50))),
        dur: 6 + i * 2,
        priority: r.priority,
      })
    }
  })
  return orders
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <Header />
      <Dashboard />
    </div>
  )
}
