import React from 'react'

export default function PlanToolbar({
  isRunning = false,
  isLocked = false,
  onPlanRoutes,
  onSimulatePeak,
  onReset,
  onImportOrders,
  onShareRoutes,
  onRefresh,
  onToggleLock,
}) {
  return (
    <div className="po-toolbar">
      <span className="po-date-label">Select date:</span>
      <input
        className="po-date-input"
        type="text"
        value="22-08-2026"
        readOnly
        title="Planning date"
      />

      <button
        type="button"
        className="btn btn-ghost"
        onClick={onImportOrders}
        title="Import a batch of orders from a file or upstream system"
      >
        Import Orders
      </button>

      {/* Primary Action Button: Dark Charcoal / Black (#1C1C1E / #0B0B0C) */}
      <button
        type="button"
        className={`btn btn-primary ${isRunning ? 'is-running' : ''}`}
        onClick={onPlanRoutes}
        disabled={isRunning}
        title="Run the quantum-inspired assignment solver"
      >
        <span className="btn-label">Plan Routes</span>
        <span className="btn-spinner" aria-hidden="true"></span>
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={onShareRoutes}
        title="Share the current plan with drivers"
      >
        Share Routes
      </button>

      <div className="po-toolbar-spacer"></div>

      <button
        type="button"
        className="btn btn-amber"
        onClick={onSimulatePeak}
        title="Simulate a high-demand surge across routes"
      >
        Simulate Peak Demand
      </button>

      <button
        type="button"
        className="btn btn-ghost"
        onClick={onReset}
        title="Return to normal demand and baseline assignment"
      >
        Reset
      </button>

      <div className="icon-btn-row">
        <button
          type="button"
          className="icon-btn"
          onClick={onRefresh}
          title="Refresh plan"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        </button>

        <button
          type="button"
          className={`icon-btn ${isLocked ? 'toggled' : ''}`}
          onClick={onToggleLock}
          title={isLocked ? 'Unlock plan for editing' : 'Lock current plan against edits'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
