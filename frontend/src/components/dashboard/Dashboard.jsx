import React, { useState, useEffect, useCallback } from 'react'
import KPIGrid from './KPIGrid.jsx'
import ActionBar from './ActionBar.jsx'
import RecommendationPanel from './RecommendationPanel.jsx'
import FleetMapPlaceholder from './FleetMapPlaceholder.jsx'
import FleetStatus from './FleetStatus.jsx'
import AnalyticsPlaceholder from './AnalyticsPlaceholder.jsx'
import BeforeAfter from './BeforeAfter.jsx'
import WhatIfSimulatorModal from './WhatIfSimulatorModal.jsx'
import ScenarioMatrixModal from './ScenarioMatrixModal.jsx'
import ShiftSummaryModal from './ShiftSummaryModal.jsx'
import api from '../../services/api.js'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function Dashboard() {
  const [simulationState, setSimulationState] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [economics, setEconomics] = useState(null)
  const [scoringMap, setScoringMap] = useState({})
  const [isOptimized, setIsOptimized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeAction, setActiveAction] = useState(null)
  const [error, setError] = useState(null)

  // Modals state
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false)
  const [isScenariosOpen, setIsScenariosOpen] = useState(false)
  const [isShiftSummaryOpen, setIsShiftSummaryOpen] = useState(false)

  // Fetch decision support data (recommendations & economics)
  const fetchDecisionData = async () => {
    try {
      const [rec, econ] = await Promise.allSettled([
        api.getRecommendation(),
        api.getEconomics(),
      ])
      if (rec.status === 'fulfilled') setRecommendation(rec.value)
      if (econ.status === 'fulfilled') setEconomics(econ.value)
    } catch (err) {
      console.warn('[Dashboard] Decision data fetch warning:', err.message)
    }
  }

  // Fetch explainable scoring for vehicles & routes
  const fetchScoringData = async (vehicles, routes) => {
    if (!vehicles || !routes || vehicles.length === 0 || routes.length === 0) return
    try {
      const scoringRes = await api.getScoring(vehicles, routes)
      if (scoringRes?.scores) {
        const map = {}
        for (const item of scoringRes.scores) {
          map[`${item.vehicle_id}_${item.route_id}`] = item
        }
        setScoringMap(map)
      }
    } catch (err) {
      console.warn('[Dashboard] Scoring fetch warning:', err.message)
    }
  }

  // Load initial simulation state & benchmark from FastAPI
  const loadInitialData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const state = await api.getSimulationState()
      setSimulationState(state)
      setIsOptimized(state.status === 'optimized' || (state.greenflow_assignments && state.greenflow_assignments.length > 0))

      if (state.benchmark) {
        setBenchmark(state.benchmark)
      } else {
        const bmk = await api.getBenchmark()
        setBenchmark(bmk)
      }

      await Promise.all([
        fetchScoringData(state.vehicles, state.routes),
        fetchDecisionData(),
      ])
    } catch (err) {
      console.error('[Dashboard] Initial data load failed:', err)
      setError(`Failed to connect to GreenFleet Backend at ${import.meta.env.VITE_API_URL || 'http://localhost:8000'}. Ensure backend server is running. (${err.message})`)
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // 1. Reset Simulation Handler
  const handleReset = async () => {
    setActiveAction('reset')
    setLoading(true)
    setError(null)
    try {
      const state = await api.resetSimulation()
      setSimulationState(state)
      setBenchmark(state.benchmark || null)
      setIsOptimized(false)
      await Promise.all([
        fetchScoringData(state.vehicles, state.routes),
        fetchDecisionData(),
      ])
    } catch (err) {
      setError(`Reset failed: ${err.message}`)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  // 2. Simulate Peak Demand Handler
  const handleSimulatePeak = async () => {
    setActiveAction('peak')
    setLoading(true)
    setError(null)
    try {
      const state = await api.simulatePeak()
      setSimulationState(state)
      setBenchmark(state.benchmark || null)
      setIsOptimized(false)
      await Promise.all([
        fetchScoringData(state.vehicles, state.routes),
        fetchDecisionData(),
      ])
    } catch (err) {
      setError(`Peak simulation failed: ${err.message}`)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  // 3. Simulate High Traffic Handler
  const handleSimulateTraffic = async () => {
    setActiveAction('traffic')
    setLoading(true)
    setError(null)
    try {
      const state = await api.simulateTraffic()
      setSimulationState(state)
      setBenchmark(state.benchmark || null)
      setIsOptimized(false)
      await Promise.all([
        fetchScoringData(state.vehicles, state.routes),
        fetchDecisionData(),
      ])
    } catch (err) {
      setError(`Traffic simulation failed: ${err.message}`)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  // 4. Run GreenFleet Quantum-Inspired Optimization Handler
  const handleOptimize = async () => {
    setActiveAction('optimize')
    setLoading(true)
    setError(null)
    try {
      const state = await api.runOptimization()
      setSimulationState(state)
      setBenchmark(state.benchmark || null)
      setIsOptimized(true)
      await Promise.all([
        fetchScoringData(state.vehicles, state.routes),
        fetchDecisionData(),
      ])
    } catch (err) {
      setError(`Optimization failed: ${err.message}`)
    } finally {
      setLoading(false)
      setActiveAction(null)
    }
  }

  const activeAssignments = isOptimized
    ? simulationState?.greenflow_assignments || []
    : simulationState?.baseline_assignments || []

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 space-y-4">
      {/* User-Visible Error Notification */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-300 shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadInitialData}
            className="flex items-center gap-1 rounded bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* 1. Commercial Economic Impact KPI Row */}
      <KPIGrid
        benchmark={benchmark}
        simulationState={simulationState}
        carbonBudget={simulationState?.carbon_budget}
        isOptimized={isOptimized}
        economics={economics}
      />

      {/* 2. Simulation & Optimization Action Bar with Planning Triggers */}
      <ActionBar
        scenario={simulationState?.scenario || 'normal'}
        status={simulationState?.status || 'normal_state'}
        isOptimized={isOptimized}
        loading={loading}
        activeAction={activeAction}
        carbonBudget={simulationState?.carbon_budget}
        onReset={handleReset}
        onSimulatePeak={handleSimulatePeak}
        onSimulateTraffic={handleSimulateTraffic}
        onOptimize={handleOptimize}
        onOpenWhatIf={() => setIsWhatIfOpen(true)}
        onOpenScenarios={() => setIsScenariosOpen(true)}
        onOpenShiftSummary={() => setIsShiftSummaryOpen(true)}
      />

      {/* 3. Dispatcher "What Should I Do?" Actionable Recommendation Panel */}
      <RecommendationPanel
        recommendation={recommendation}
        isOptimized={isOptimized}
        onOptimize={handleOptimize}
      />

      {/* 4. Main Network Map & Fleet Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left / Large: Fleet & Route Network */}
        <div className="lg:col-span-8 flex flex-col min-h-[420px]">
          <FleetMapPlaceholder />
        </div>

        {/* Right / Narrow: Fleet Status & Explainability */}
        <div className="lg:col-span-4 flex flex-col min-h-[420px]">
          <FleetStatus
            vehicles={simulationState?.vehicles || []}
            routes={simulationState?.routes || []}
            assignments={activeAssignments}
            scoringMap={scoringMap}
            isOptimized={isOptimized}
          />
        </div>
      </div>

      {/* 5. Analytics Panels (Fuel Consumption Analysis & Fleet Efficiency) */}
      <AnalyticsPlaceholder
        routes={simulationState?.routes || []}
        baselineAssignments={simulationState?.baseline_assignments || []}
        greenflowAssignments={simulationState?.greenflow_assignments || []}
        isOptimized={isOptimized}
        benchmark={benchmark}
      />

      {/* 6. Comparative Evaluation: Baseline vs GreenFleet */}
      <BeforeAfter
        benchmark={benchmark}
        isOptimized={isOptimized}
      />

      {/* 7. Commercial Decision Support Modals */}
      <WhatIfSimulatorModal
        isOpen={isWhatIfOpen}
        onClose={() => setIsWhatIfOpen(false)}
      />

      <ScenarioMatrixModal
        isOpen={isScenariosOpen}
        onClose={() => setIsScenariosOpen(false)}
      />

      <ShiftSummaryModal
        isOpen={isShiftSummaryOpen}
        onClose={() => setIsShiftSummaryOpen(false)}
        simulationState={simulationState}
        benchmark={benchmark}
        economics={economics}
      />
    </main>
  )
}

