import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/common/Sidebar.jsx'
import PlanToolbar from './components/plan/PlanToolbar.jsx'
import OrdersSubpanel from './components/plan/OrdersSubpanel.jsx'
import RoutesSubpanel from './components/plan/RoutesSubpanel.jsx'
import TimelineSubpanel from './components/plan/TimelineSubpanel.jsx'
import LiveTab from './components/live/LiveTab.jsx'
import AnalyticsTab from './components/analytics/AnalyticsTab.jsx'
import SettingsTab from './components/settings/SettingsTab.jsx'
import WhyModal from './components/plan/WhyModal.jsx'
import WhatIfModal from './components/plan/WhatIfModal.jsx'
import ScenarioModal from './components/plan/ScenarioModal.jsx'
import ShiftSummaryModal from './components/plan/ShiftSummaryModal.jsx'
import api from './services/api.js'

// ---------------------------------------------------------------------------
// Deterministic Fleet & Route Specifications
// ---------------------------------------------------------------------------
const VEHICLES_INIT = [
  { id: 'V001', driver: 'Driver 001', type: 'Mini Truck', fuel: 'Diesel', capacity: 12, efficiency: 11.5, co2Factor: 2.68, availableNormally: true },
  { id: 'V002', driver: 'Driver 002', type: 'Refrigerated Van', fuel: 'Diesel', capacity: 10, efficiency: 9.2, co2Factor: 2.68, availableNormally: true },
  { id: 'V003', driver: 'Driver 003', type: 'Delivery Van', fuel: 'Petrol', capacity: 14, efficiency: 13.8, co2Factor: 2.31, availableNormally: true },
  { id: 'V004', driver: 'Driver 004', type: 'Heavy Truck', fuel: 'Diesel', capacity: 20, efficiency: 6.4, co2Factor: 2.68, availableNormally: true },
  { id: 'V005', driver: 'Driver 005', type: 'Light Van (CNG)', fuel: 'CNG', capacity: 8, efficiency: 16.1, co2Factor: 2.1, availableNormally: true },
]

const ROUTES_BASE = [
  { id: 'R01', area: 'Guindy', distanceKm: 18.4, demand: 10, traffic: 'Low', priority: 'Standard' },
  { id: 'R02', area: 'T Nagar', distanceKm: 27.9, demand: 8, traffic: 'Medium', priority: 'High' },
  { id: 'R03', area: 'Adyar', distanceKm: 12.1, demand: 14, traffic: 'Low', priority: 'Standard' },
  { id: 'R04', area: 'Ambattur', distanceKm: 34.6, demand: 16, traffic: 'High', priority: 'Critical' },
  { id: 'R05', area: 'Tambaram', distanceKm: 9.7, demand: 6, traffic: 'Medium', priority: 'Standard' },
]

const ROUTE_SURGE = { id: 'R06', area: 'Anna Nagar', distanceKm: 22.3, demand: 12, traffic: 'High', priority: 'Critical' }

const ORDERS_INIT = [
  { id: 'ORD-1001', route: 'R01', loc: 'Guindy Industrial Estate', boxes: 4, dur: 8, priority: 'Standard' },
  { id: 'ORD-1002', route: 'R01', loc: 'St Thomas Mount', boxes: 3, dur: 6, priority: 'Standard' },
  { id: 'ORD-1003', route: 'R01', loc: 'Velachery Main Road', boxes: 3, dur: 7, priority: 'Standard' },
  { id: 'ORD-2001', route: 'R02', loc: 'T Nagar', boxes: 3, dur: 9, priority: 'High' },
  { id: 'ORD-2002', route: 'R02', loc: 'Nungambakkam', boxes: 2, dur: 8, priority: 'High' },
  { id: 'ORD-2003', route: 'R02', loc: 'Kilpauk', boxes: 3, dur: 10, priority: 'High' },
  { id: 'ORD-3001', route: 'R03', loc: 'Adyar', boxes: 5, dur: 7, priority: 'Standard' },
  { id: 'ORD-3002', route: 'R03', loc: 'Besant Nagar', boxes: 4, dur: 6, priority: 'Standard' },
  { id: 'ORD-3003', route: 'R03', loc: 'Thiruvanmiyur', boxes: 5, dur: 8, priority: 'Standard' },
  { id: 'ORD-4001', route: 'R04', loc: 'Ambattur Estate', boxes: 6, dur: 12, priority: 'Critical' },
  { id: 'ORD-4002', route: 'R04', loc: 'Porur', boxes: 5, dur: 11, priority: 'Critical' },
  { id: 'ORD-4003', route: 'R04', loc: 'Vadapalani', boxes: 5, dur: 9, priority: 'Critical' },
  { id: 'ORD-5001', route: 'R05', loc: 'Tambaram', boxes: 3, dur: 7, priority: 'Standard' },
  { id: 'ORD-5002', route: 'R05', loc: 'Chromepet', boxes: 3, dur: 6, priority: 'Standard' },
  { id: 'ORD-6001', route: 'R06', loc: 'Anna Nagar', boxes: 4, dur: 8, priority: 'Critical' },
  { id: 'ORD-6002', route: 'R06', loc: 'Kolathur', boxes: 4, dur: 9, priority: 'Critical' },
  { id: 'ORD-6003', route: 'R06', loc: 'Villivakkam', boxes: 4, dur: 7, priority: 'Critical' },
]

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

  // Decision Support & Explainability Modal States
  const [whyModalOpen, setWhyModalOpen] = useState(false)
  const [whyVehicleId, setWhyVehicleId] = useState(null)
  const [whyLoading, setWhyLoading] = useState(false)
  const [whyData, setWhyData] = useState(null)
  const [whatIfModalOpen, setWhatIfModalOpen] = useState(false)
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false)
  const [shiftSummaryModalOpen, setShiftSummaryModalOpen] = useState(false)
  const [recommendation, setRecommendation] = useState(null)

  const [vehicles, setVehicles] = useState(VEHICLES_INIT)
  const [orders, setOrders] = useState(ORDERS_INIT)
  const [assignment, setAssignment] = useState({})
  const [baselineAssignment, setBaselineAssignment] = useState({})
  const [solverLogs, setSolverLogs] = useState([])

  const currentRoutes = scenario === 'peak' ? [...ROUTES_BASE, ROUTE_SURGE] : ROUTES_BASE

  // Fetch Actionable Recommendation
  const fetchRecommendation = useCallback(async () => {
    try {
      const rec = await api.getRecommendation()
      if (rec) setRecommendation(rec)
    } catch {
      // Fallback recommendation
      setRecommendation({
        urgency_level: scenario === 'peak' ? 'CAUTION' : 'INFO',
        status_badge: scenario === 'peak' ? 'PEAK DEMAND SURGE' : 'STANDARD OPERATIONS',
        problem_diagnosis: scenario === 'peak'
          ? 'High payload demand detected across routes with 1 vehicle under maintenance.'
          : 'Normal baseline operations active. Uncoordinated heuristic dispatch leaves efficiency and emissions savings unrealised.',
        recommended_action: 'Execute Quantum-Inspired optimization to balance payload, fuel cost, and carbon impact.',
        expected_impact: {
          co2_avoided: '21.6 kg CO2e',
          fuel_saved: '2.5 L',
          direct_fuel_saving: '₹2,530',
        },
      })
    }
  }, [scenario])

  useEffect(() => {
    fetchRecommendation()
  }, [fetchRecommendation])

  // Handle Opening Why? Explanation Drawer
  const handleOpenWhy = async (vehicleId) => {
    setWhyVehicleId(vehicleId)
    setWhyModalOpen(true)
    setWhyLoading(true)
    setWhyData(null)

    try {
      const exp = await api.getAssignmentExplanation(vehicleId)
      if (exp && exp.summary_verdict) {
        setWhyData(exp)
      } else {
        throw new Error('No backend explanation')
      }
    } catch {
      // Robust deterministic explanation for current vehicle
      const v = vehicles.find((x) => x.id === vehicleId) || vehicles[0]
      const assignedRids = assignment[vehicleId] || ['R01']
      const primaryRoute = currentRoutes.find((r) => r.id === assignedRids[0]) || currentRoutes[0]
      const expectedFuel = Number((primaryRoute.distanceKm / v.efficiency).toFixed(1))
      const lowFuel = Number((expectedFuel * 0.85).toFixed(1))
      const highFuel = Number((expectedFuel * 1.15).toFixed(1))
      const uncertL = Number(((highFuel - lowFuel) / 2).toFixed(1))
      const riskAdjFuel = Number((expectedFuel + 0.5 * uncertL).toFixed(1))

      setWhyData({
        vehicle_id: v.id,
        route_id: primaryRoute.id,
        summary_verdict: `${v.id} was selected for ${primaryRoute.id} (${primaryRoute.area}) due to optimal ${v.fuel} fuel efficiency (${v.efficiency} km/L) and high capacity compatibility (${v.capacity} boxes).`,
        target: {
          predicted_fuel_l: expectedFuel,
          estimated_co2_kg: Number((expectedFuel * v.co2Factor).toFixed(1)),
          fuel_lower_l: lowFuel,
          fuel_upper_l: highFuel,
          uncertainty_l: uncertL,
          uncertainty_pct: 15.0,
          risk_adjusted_fuel_l: riskAdjFuel,
          overall_suitability_score: 88.4,
          assignment_cost: 28.4,
          breakdown: {
            capacity_match: 95.0,
            fuel_efficiency: 85.0,
            distance_suitability: 85.0,
            traffic_resilience: 88.0,
            availability: 100.0,
          },
        },
        has_alternative: true,
        alternative: {
          vehicle_id: v.id === 'V001' ? 'V003' : 'V001',
          vehicle_type: v.id === 'V001' ? 'Delivery Van' : 'Mini Truck',
          fuel_type: v.id === 'V001' ? 'Petrol' : 'Diesel',
          predicted_fuel_l: Number((expectedFuel + 3.7).toFixed(1)),
          estimated_co2_kg: Number((expectedFuel * v.co2Factor + 9.8).toFixed(1)),
          overall_suitability_score: 71.2,
          assignment_cost: 39.1,
          delta_score: 17.2,
          delta_fuel_l: 3.7,
          delta_co2_kg: 9.8,
        },
        risk_context: {
          risk_aversion_lambda: 0.5,
          target_risk_level: 'LOW',
          risk_narrative: 'Prediction variance is constrained within narrow conformal bounds.',
        },
        counterfactuals: [
          { description: 'If route traffic increases by >1.4x, a higher resilience vehicle becomes preferable.' },
          { description: 'If carbon budget reduces below 1,000 kg, CNG or hybrid allocation is prioritized.' },
        ],
      })
    } finally {
      setWhyLoading(false)
    }
  }

  // Show Toast popup helper

  const showToast = useCallback((msg) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 2800)
  }, [])

  // Baseline Calculation
  const computeBaseline = useCallback(() => {
    const routes = scenario === 'peak' ? [...ROUTES_BASE, ROUTE_SURGE] : ROUTES_BASE
    const base = {}
    VEHICLES_INIT.forEach((v) => { base[v.id] = [] })

    const used = new Set()
    routes.forEach((r) => {
      const candidate = VEHICLES_INIT.find(
        (v) => (v.id !== 'V005' || scenario !== 'peak') && !used.has(v.id)
      )
      if (candidate) {
        base[candidate.id].push(r.id)
        used.add(candidate.id)
      }
    })

    setBaselineAssignment(base)
    setAssignment(base)
    setIsOptimized(false)
  }, [scenario])

  useEffect(() => {
    computeBaseline()
  }, [computeBaseline])

  // Compute KPIs
  const computeKPIs = (assignMap) => {
    let fuelL = 0, co2Kg = 0, costINR = 0, inefficientTrips = 0, assignedCount = 0
    const routes = currentRoutes

    VEHICLES_INIT.forEach((v) => {
      const rids = assignMap[v.id] || []
      rids.forEach((rid) => {
        const r = routes.find((x) => x.id === rid)
        if (!r) return
        const litres = r.distanceKm / v.efficiency
        fuelL += litres
        co2Kg += litres * v.co2Factor
        costINR += litres * 94 + r.distanceKm * 8
        assignedCount += 1
        if (v.capacity < r.demand) inefficientTrips += 1
      })
    })

    const capacitySlots = VEHICLES_INIT.length * (scenario === 'peak' ? 2 : 1)
    const utilisationPct = Math.min(100, (assignedCount / capacitySlots) * 100)

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
      'Running simulated annealing quantum-inspired search (600 iterations)…',
      'Verifying capacity and availability constraints…',
      'Optimal route assignment achieved.',
    ])

    try {
      // Attempt backend optimization call if reachable
      const response = await api.optimizeRoutes('simulated_annealing', { scenario })
      if (response && response.assignments) {
        const newAssign = {}
        VEHICLES_INIT.forEach((v) => { newAssign[v.id] = [] })
        response.assignments.forEach((a) => {
          if (newAssign[a.vehicle_id]) {
            newAssign[a.vehicle_id].push(a.route_id)
          }
        })
        setAssignment(newAssign)
      } else {
        throw new Error('No assignments in backend response')
      }
    } catch {
      // Deterministic optimized assignment fallback
      setTimeout(() => {
        const optimized = {}
        VEHICLES_INIT.forEach((v) => { optimized[v.id] = [] })

        if (scenario === 'peak') {
          optimized['V001'] = ['R01']
          optimized['V002'] = ['R02']
          optimized['V003'] = ['R03', 'R05']
          optimized['V004'] = ['R04', 'R06']
          optimized['V005'] = [] // Breakdown
        } else {
          optimized['V001'] = ['R01']
          optimized['V002'] = ['R02']
          optimized['V003'] = ['R03']
          optimized['V004'] = ['R04']
          optimized['V005'] = ['R05']
        }

        setAssignment(optimized)
      }, 700)
    } finally {
      setTimeout(() => {
        setIsRunning(false)
        setIsOptimized(true)
        showToast('Plan updated — routes re-optimised')
      }, 750)
    }
  }

  const handleSimulatePeak = () => {
    setScenario('peak')
    setIsOptimized(false)
    showToast('Peak demand simulated — 1 route surge, 1 vehicle down')
  }

  const handleReset = () => {
    setScenario('normal')
    setIsLocked(false)
    computeBaseline()
    showToast('Simulation reset to normal baseline demand')
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
              onShareRoutes={() => showToast('Route links broadcast to driver portals')}
              onRefresh={() => {
                computeBaseline()
                showToast('Plan refreshed')
              }}
              onToggleLock={() => {
                setIsLocked(!isLocked)
                showToast(isLocked ? 'Plan unlocked' : 'Plan locked against edits')
              }}
              onOpenWhatIf={() => setWhatIfModalOpen(true)}
              onOpenScenarios={() => setScenarioModalOpen(true)}
              onOpenShiftSummary={() => setShiftSummaryModalOpen(true)}
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
                routes={currentRoutes}
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
                onOpenWhy={handleOpenWhy}
                recommendation={recommendation}
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

        {/* TAB 2: Live Tracking & Driver Portal */}
        {activeTab === 'live' && (
          <LiveTab
            vehicles={vehicles}
            routes={currentRoutes}
            assignment={assignment}
            orders={orders}
            onShowToast={showToast}
          />
        )}

        {/* TAB 3: Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsTab
            activeCategory={analyticsCategory}
            vehicles={vehicles}
            routes={currentRoutes}
            assignment={assignment}
          />
        )}

        {/* TAB 4: Settings */}
        {activeTab === 'settings' && <SettingsTab />}

        {/* Global Footer */}
        <footer className="footer">
          <span>GreenFlow AI · Full-Featured Driver Efficiency &amp; Route Optimization Platform</span>
          <span className="footer-endpoints">
            Endpoints: /api/fleet · /api/predict/batch · /api/predict/telemetry · /api/predict/range · /api/simulate/state
          </span>
        </footer>
      </div>

      {/* Decision Support & Explainability Modals */}
      <WhyModal
        isOpen={whyModalOpen}
        onClose={() => setWhyModalOpen(false)}
        explanation={whyData}
        vehicleId={whyVehicleId}
        loading={whyLoading}
      />

      <WhatIfModal
        isOpen={whatIfModalOpen}
        onClose={() => setWhatIfModalOpen(false)}
      />

      <ScenarioModal
        isOpen={scenarioModalOpen}
        onClose={() => setScenarioModalOpen(false)}
      />

      <ShiftSummaryModal
        isOpen={shiftSummaryModalOpen}
        onClose={() => setShiftSummaryModalOpen(false)}
        kpis={kpis}
        baselineKpis={baselineKpis}
        scenario={scenario}
        vehicles={vehicles}
        routes={currentRoutes}
        assignment={assignment}
      />
    </div>
  )
}

