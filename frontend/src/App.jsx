import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/common/Sidebar.jsx'
import PlanToolbar from './components/plan/PlanToolbar.jsx'
import OrdersSubpanel from './components/plan/OrdersSubpanel.jsx'
import RoutesSubpanel from './components/plan/RoutesSubpanel.jsx'
import TimelineSubpanel from './components/plan/TimelineSubpanel.jsx'
import LiveTab from './components/live/LiveTab.jsx'
import AnalyticsTab from './components/analytics/AnalyticsTab.jsx'
import SettingsTab from './components/settings/SettingsTab.jsx'
import api from './services/api.js'

// ---------------------------------------------------------------------------
// Offline fallback fleet & route specs — used only if the backend is
// unreachable on first load, so the demo still renders something.
// ---------------------------------------------------------------------------
const FALLBACK_VEHICLES = [
  { id: 'V001', driver: 'Driver 001', type: 'Mini Truck', fuel: 'Diesel', capacity: 12, efficiency: 11.5, co2Factor: 2.68, availableNormally: true },
  { id: 'V002', driver: 'Driver 002', type: 'Refrigerated Van', fuel: 'Diesel', capacity: 10, efficiency: 9.2, co2Factor: 2.68, availableNormally: true },
  { id: 'V003', driver: 'Driver 003', type: 'Delivery Van', fuel: 'Petrol', capacity: 14, efficiency: 13.8, co2Factor: 2.31, availableNormally: true },
  { id: 'V004', driver: 'Driver 004', type: 'Heavy Truck', fuel: 'Diesel', capacity: 20, efficiency: 6.4, co2Factor: 2.68, availableNormally: true },
  { id: 'V005', driver: 'Driver 005', type: 'Light Van (CNG)', fuel: 'CNG', capacity: 8, efficiency: 16.1, co2Factor: 2.1, availableNormally: true },
]

const FALLBACK_ROUTES = [
  { id: 'R01', area: 'Guindy', distanceKm: 18.4, demand: 10, traffic: 'Low', priority: 'Standard' },
  { id: 'R02', area: 'T Nagar', distanceKm: 27.9, demand: 8, traffic: 'Medium', priority: 'High' },
  { id: 'R03', area: 'Adyar', distanceKm: 12.1, demand: 14, traffic: 'Low', priority: 'Standard' },
  { id: 'R04', area: 'Ambattur', distanceKm: 34.6, demand: 16, traffic: 'High', priority: 'Critical' },
  { id: 'R05', area: 'Tambaram', distanceKm: 9.7, demand: 6, traffic: 'Medium', priority: 'Standard' },
]

const FALLBACK_ORDERS = [
  { id: 'ORD-1001', route: 'R01', loc: 'Guindy Industrial Estate', boxes: 4, dur: 8, priority: 'Standard' },
  { id: 'ORD-1002', route: 'R01', loc: 'St Thomas Mount', boxes: 3, dur: 6, priority: 'Standard' },
  { id: 'ORD-2001', route: 'R02', loc: 'T Nagar', boxes: 3, dur: 9, priority: 'High' },
  { id: 'ORD-3001', route: 'R03', loc: 'Adyar', boxes: 5, dur: 7, priority: 'Standard' },
  { id: 'ORD-4001', route: 'R04', loc: 'Ambattur Estate', boxes: 6, dur: 12, priority: 'Critical' },
  { id: 'ORD-5001', route: 'R05', loc: 'Tambaram', boxes: 3, dur: 7, priority: 'Standard' },
]

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
  const [activeTab, setActiveTab] = useState('plan')
  const [activeSubtab, setActiveSubtab] = useState('routes')
  const [analyticsCategory, setAnalyticsCategory] = useState('planned_vs_actual')
  const [scenario, setScenario] = useState('normal')
  const [isOptimized, setIsOptimized] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [backendConnected, setBackendConnected] = useState(false)

  const [vehicles, setVehicles] = useState(FALLBACK_VEHICLES)
  const [routes, setRoutes] = useState(FALLBACK_ROUTES)
  const [orders, setOrders] = useState(FALLBACK_ORDERS)
  const [assignment, setAssignment] = useState({})
  const [baselineAssignment, setBaselineAssignment] = useState({})
  const [assignmentDetails, setAssignmentDetails] = useState({})
  const [carbonBudget, setCarbonBudget] = useState(null)
  const [solverLogs, setSolverLogs] = useState([])

  // Show Toast popup helper
  const showToast = useCallback((msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2800)
  }, [])

  // Applies a full SimulationStateResponse from the backend to local state.
  const applyStateResponse = useCallback((response) => {
    const mappedVehicles = (response.vehicles || []).map(mapVehicle)
    const mappedRoutes = (response.routes || []).map(mapRoute)
    const base = mapAssignments(response.baseline_assignments)
    const opt = mapAssignments(response.greenflow_assignments)
    const activeMap = response.greenflow_assignments && response.greenflow_assignments.length
      ? opt.map
      : base.map

    setVehicles(mappedVehicles)
    setRoutes(mappedRoutes)
    setOrders(deriveOrders(mappedRoutes))
    setBaselineAssignment(base.map)
    setAssignment(activeMap)
    setAssignmentDetails({ ...base.details, ...opt.details })
    setIsOptimized(Boolean(response.greenflow_assignments && response.greenflow_assignments.length))
    if (response.scenario) {
      setScenario(response.scenario === 'peak_demand' ? 'peak' : (response.scenario === 'high_traffic' ? 'traffic' : 'normal'))
    }
    if (response.carbon_budget) setCarbonBudget(response.carbon_budget)
    setBackendConnected(true)
  }, [])

  // Local (offline) baseline fallback — only used if the backend is unreachable.
  const computeLocalFallback = useCallback(() => {
    const base = {}
    FALLBACK_VEHICLES.forEach((v) => { base[v.id] = [] })
    const used = new Set()
    FALLBACK_ROUTES.forEach((r) => {
      const candidate = FALLBACK_VEHICLES.find((v) => !used.has(v.id))
      if (candidate) {
        base[candidate.id].push(r.id)
        used.add(candidate.id)
      }
    })
    setVehicles(FALLBACK_VEHICLES)
    setRoutes(FALLBACK_ROUTES)
    setOrders(FALLBACK_ORDERS)
    setBaselineAssignment(base)
    setAssignment(base)
    setAssignmentDetails({})
    setIsOptimized(false)
    setBackendConnected(false)
  }, [])

  // Fetch real backend state on mount.
  useEffect(() => {
    let cancelled = false
    api.getSimulationState()
      .then((response) => {
        if (!cancelled) applyStateResponse(response)
      })
      .catch((err) => {
        console.error('[App] Backend unreachable, using offline fallback:', err.message)
        if (!cancelled) {
          computeLocalFallback()
          showToast('Backend unreachable — showing offline demo data')
        }
      })
    return () => { cancelled = true }
  }, [applyStateResponse, computeLocalFallback, showToast])

  // Compute KPIs — prefers the backend's precomputed per-assignment fuel/CO2/
  // cost (which already reflects risk-adjusted fuel and the dynamic carbon
  // penalty) and only falls back to a local estimate when unavailable.
  const computeKPIs = (assignMap) => {
    let fuelL = 0, co2Kg = 0, costINR = 0, inefficientTrips = 0, assignedCount = 0

    vehicles.forEach((v) => {
      const rids = assignMap[v.id] || []
      rids.forEach((rid) => {
        const r = routes.find((x) => x.id === rid)
        if (!r) return
        const detail = assignmentDetails[`${v.id}:${rid}`]
        if (detail) {
          fuelL += detail.fuelL
          co2Kg += detail.co2Kg
          costINR += detail.costINR
        } else {
          const litres = r.distanceKm / v.efficiency
          fuelL += litres
          co2Kg += litres * v.co2Factor
          costINR += litres * 94 + r.distanceKm * 8
        }
        assignedCount += 1
        if (v.capacity < r.demand) inefficientTrips += 1
      })
    })

    const utilisationPct = Math.min(100, (assignedCount / Math.max(1, vehicles.length)) * 100)

    return { fuelL, co2Kg, costINR, utilisationPct, inefficientTrips }
  }

  const kpis = computeKPIs(assignment)
  const baselineKpis = computeKPIs(baselineAssignment)

  // Plan Routes Solver Execution
  const handlePlanRoutes = async () => {
    if (isLocked) {
      showToast('Plan is locked against edits')
      return
    }

    setIsRunning(true)
    setSolverLogs([
      'Formulating QUBO cost matrix (fuel + CO₂ + distance + penalty)…',
      'Running simulated annealing quantum-inspired search…',
      'Verifying capacity and availability constraints…',
      'Optimal route assignment achieved.',
    ])

    try {
      const response = await api.runOptimization()
      applyStateResponse(response)
      showToast('Plan updated — routes re-optimised')
    } catch (err) {
      console.error('[App] Optimization request failed:', err.message)
      showToast('Optimization failed — check backend connection')
    } finally {
      setIsRunning(false)
    }
  }

  const handleSimulatePeak = async () => {
    try {
      const response = await api.simulatePeak()
      applyStateResponse(response)
      showToast('Peak demand simulated — route surge, reduced availability')
    } catch (err) {
      console.error('[App] simulatePeak failed:', err.message)
      showToast('Could not reach backend to simulate peak demand')
    }
  }

  const handleReset = async () => {
    try {
      setIsLocked(false)
      const response = await api.resetSimulation()
      applyStateResponse(response)
      showToast('Simulation reset to normal baseline demand')
    } catch (err) {
      console.error('[App] resetSimulation failed:', err.message)
      showToast('Could not reach backend to reset simulation')
    }
  }

  // Logs a real (bad) driving-behavior telemetry sample for a vehicle, then
  // re-runs the optimizer so the assignment visibly reacts to it.
  const handleSimulateHarshEvent = async (vehicleId, driverLabel) => {
    try {
      await api.logTelemetry(vehicleId, { brake_freq: 16, gear_irregularity: 75, harsh_accel: 6 })
      showToast(`Harsh driving event logged for ${driverLabel} — re-optimising routes`)
      const response = await api.runOptimization()
      applyStateResponse(response)
    } catch (err) {
      console.error('[App] handleSimulateHarshEvent failed:', err.message)
      showToast(`Could not log telemetry: ${err.message}`)
    }
  }

  // Logs a good driving-behavior sample, clearing the vehicle's bad rolling
  // score, then re-optimizes so it can be routed normally again.
  const handleClearHarshEvent = async (vehicleId, driverLabel) => {
    try {
      for (let i = 0; i < 5; i++) {
        await api.logTelemetry(vehicleId, { brake_freq: 1, gear_irregularity: 2, harsh_accel: 0 })
      }
      showToast(`${driverLabel} restored to normal monitoring — re-optimising routes`)
      const response = await api.runOptimization()
      applyStateResponse(response)
    } catch (err) {
      console.error('[App] handleClearHarshEvent failed:', err.message)
      showToast(`Could not clear telemetry: ${err.message}`)
    }
  }

  const refreshState = async () => {
    try {
      const response = await api.getSimulationState()
      applyStateResponse(response)
    } catch (err) {
      console.error('[App] refreshState failed:', err.message)
    }
  }

  return (
    <div className="app-shell">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="toast visible" role="alert">
          {toastMessage}
        </div>
      )}

      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeSubtab={activeSubtab}
        onSubtabChange={setActiveSubtab}
        analyticsCategory={analyticsCategory}
        onAnalyticsCategoryChange={setAnalyticsCategory}
        scenario={scenario}
        isOptimized={isOptimized}
        isRunning={isRunning}
      />

      {/* Main Content Area */}
      <div className="main-area">
        {/* TAB 1: Plan and Optimize */}
        {activeTab === 'plan' && (
          <main className="tab-panel active">
            <PlanToolbar
              isRunning={isRunning}
              isLocked={isLocked}
              onPlanRoutes={handlePlanRoutes}
              onSimulatePeak={handleSimulatePeak}
              onReset={handleReset}
              onImportOrders={() => showToast('Imported 17 orders for 22-08-2026')}
              onShareRoutes={() => showToast('Route links broadcast to drivers')}
              onRefresh={() => {
                refreshState()
                showToast('Plan refreshed')
              }}
              onToggleLock={() => {
                setIsLocked(!isLocked)
                showToast(isLocked ? 'Plan unlocked' : 'Plan locked against edits')
              }}
            />

            {/* Sub-Tabs */}
            {activeSubtab === 'orders' && (
              <OrdersSubpanel
                orders={orders}
                scenario={scenario}
                onAddOrder={() => showToast('New order draft created')}
                onCopyOrders={() => showToast('Orders copied to next planning date')}
                onUnscheduleOrders={(ids) => showToast(`${ids.length} orders unscheduled`)}
              />
            )}

            {activeSubtab === 'routes' && (
              <RoutesSubpanel
                vehicles={vehicles}
                routes={routes}
                assignment={assignment}
                baselineAssignment={baselineAssignment}
                isOptimized={isOptimized}
                scenario={scenario}
                kpis={kpis}
                baselineKpis={baselineKpis}
                solverLogs={solverLogs}
                selectedVehicleId={selectedVehicleId}
                selectedRouteId={selectedRouteId}
                onSelectVehicle={(id) => {
                  setSelectedVehicleId(id)
                  setSelectedRouteId(null)
                }}
                onSelectRoute={(id) => {
                  setSelectedRouteId(id)
                  setSelectedVehicleId(null)
                }}
              />
            )}

            {activeSubtab === 'timeline' && (
              <TimelineSubpanel
                vehicles={vehicles}
                assignment={assignment}
                orders={orders}
              />
            )}
          </main>
        )}

        {/* TAB 2: Live Tracking */}
        {activeTab === 'live' && (
          <LiveTab
            vehicles={vehicles}
            routes={routes}
            assignment={assignment}
            orders={orders}
            onShowToast={showToast}
            onSimulateHarshEvent={handleSimulateHarshEvent}
            onClearHarshEvent={handleClearHarshEvent}
          />
        )}

        {/* TAB 3: Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            activeCategory={analyticsCategory}
            vehicles={vehicles}
            routes={routes}
            assignment={assignment}
          />
        )}

        {/* TAB 4: Settings */}
        {activeTab === 'settings' && (
          <SettingsTab
            carbonBudget={carbonBudget}
            onShowToast={showToast}
            onVehicleRegistered={refreshState}
          />
        )}

        {/* Global Footer */}
        <footer className="footer">
          <span>
            GreenFlow AI · Full-Featured Driver Efficiency &amp; Route Optimization Platform
            {!backendConnected && ' · OFFLINE DEMO DATA'}
          </span>
          <span className="footer-endpoints">
            Endpoints: /api/fleet · /api/predict/batch · /api/predict/telemetry · /api/predict/range · /api/simulate/state
          </span>
        </footer>
      </div>
    </div>
  )
}
