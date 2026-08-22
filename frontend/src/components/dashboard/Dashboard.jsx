import React, { useState, useEffect, useCallback } from 'react'
import KPIGrid from './KPIGrid.jsx'
import ActionBar from './ActionBar.jsx'
import FleetMapPlaceholder from './FleetMapPlaceholder.jsx'
import FleetStatus from './FleetStatus.jsx'
import AnalyticsPlaceholder from './AnalyticsPlaceholder.jsx'
import BeforeAfter from './BeforeAfter.jsx'

export default function Dashboard() {
  const [simulationState, setSimulationState] = useState(null)
  const [benchmark, setBenchmark] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeAction, setActiveAction] = useState('')
  const [error, setError] = useState(null)

  // Fetch current simulation state and benchmark from backend
  const fetchState = useCallback(async () => {
    try {
      setError(null)
      const [stateRes, benchRes] = await Promise.all([
        fetch('/api/simulate/state'),
        fetch('/api/benchmark'),
      ])
      if (stateRes.ok) {
        const data = await stateRes.json()
        setSimulationState(data)
      }
      if (benchRes.ok) {
        const benchData = await benchRes.json()
        setBenchmark(benchData)
      }
    } catch (err) {
      console.error('Failed to fetch simulation data:', err)
      setError('Backend connection error')
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Simulation Action Handlers
  const handleReset = async () => {
    setLoading(true)
    setActiveAction('reset')
    try {
      const res = await fetch('/api/simulate/reset', { method: 'POST' })
      if (res.ok) {
        await fetchState()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setActiveAction('')
    }
  }

  const handlePeakDemand = async () => {
    setLoading(true)
    setActiveAction('peak')
    try {
      const res = await fetch('/api/simulate/peak', { method: 'POST' })
      if (res.ok) {
        await fetchState()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setActiveAction('')
    }
  }

  const handleHighTraffic = async () => {
    setLoading(true)
    setActiveAction('traffic')
    try {
      const res = await fetch('/api/simulate/traffic', { method: 'POST' })
      if (res.ok) {
        await fetchState()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setActiveAction('')
    }
  }

  const handleOptimize = async () => {
    setLoading(true)
    setActiveAction('optimize')
    try {
      const res = await fetch('/api/simulate/optimize', { method: 'POST' })
      if (res.ok) {
        await fetchState()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setActiveAction('')
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 space-y-4">
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">
          {error} — ensure backend is running on port 8000
        </div>
      )}

      {/* 1. Primary Metrics Row */}
      <KPIGrid benchmark={benchmark} state={simulationState} />

      {/* 2. Simulation & Optimization Action Bar */}
      <ActionBar
        scenario={simulationState?.scenario || 'normal'}
        status={simulationState?.status || 'ready'}
        loading={loading}
        activeAction={activeAction}
        onReset={handleReset}
        onPeak={handlePeakDemand}
        onTraffic={handleHighTraffic}
        onOptimize={handleOptimize}
      />

      {/* 3. Main Network Map & Fleet Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left / Large: Fleet & Route Network (8 of 12 cols on desktop) */}
        <div className="lg:col-span-8 flex flex-col min-h-[420px]">
          <FleetMapPlaceholder state={simulationState} benchmark={benchmark} />
        </div>

        {/* Right / Narrow: Fleet Status (4 of 12 cols on desktop) */}
        <div className="lg:col-span-4 flex flex-col min-h-[420px]">
          <FleetStatus state={simulationState} benchmark={benchmark} />
        </div>
      </div>

      {/* 4. Analytics Panels (Fuel Consumption Analysis & Fleet Efficiency) */}
      <AnalyticsPlaceholder state={simulationState} benchmark={benchmark} />

      {/* 5. Comparative Evaluation: Baseline vs GreenFleet */}
      <BeforeAfter benchmark={benchmark} />
    </main>
  )
}
