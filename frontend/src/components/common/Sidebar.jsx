import React from 'react'

export default function Sidebar({
  activeTab,
  onTabChange,
  activeSubtab,
  onSubtabChange,
  analyticsCategory,
  onAnalyticsCategoryChange,
  scenario = 'normal',
  isOptimized = false,
  isRunning = false,
}) {
  const isPlanOpen = activeTab === 'plan'
  const isAnalyticsOpen = activeTab === 'analytics'

  const analyticsCategories = [
    { key: 'planned_vs_actual', label: 'Planned vs. Actual' },
    { key: 'order_status', label: 'Order Status' },
    { key: 'rescheduled', label: 'Rescheduled Orders' },
    { key: 'arrival_accuracy', label: 'Arrival Accuracy' },
    { key: 'order_type', label: 'Order Type' },
    { key: 'time_worked', label: 'Time Worked' },
    { key: 'distance_traveled', label: 'Distance Traveled' },
    { key: 'customer_feedback', label: 'Customer Feedback' },
    { key: 'plan_history', label: 'Plan History' },
  ]

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <svg className="brand-mark" width="28" height="28" viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <path d="M15 2 L26 9 V21 L15 28 L4 21 V9 Z" stroke="#8A8D93" strokeWidth="1.4" fill="none" />
          <path d="M9 16.5 L13.2 20.5 L21.5 10.5" stroke="#4C8DFF" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="brand-text">
          <span className="brand-name">GreenFlow<span className="brand-ai">AI</span></span>
          <span className="brand-sub">Fleet Optimisation Console</span>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="sidebar-nav" aria-label="Primary sections">
        {/* Plan and Optimize */}
        <div className="nav-group">
          <button
            type="button"
            className={`sidebar-item ${isPlanOpen ? 'active' : ''}`}
            onClick={() => onTabChange('plan')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 3v3M16 3v3" />
              <path d="M8 14l2.2 2.2L16 11" />
            </svg>
            <span>Plan and Optimize</span>
            <svg className="chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {isPlanOpen && (
            <div className="nav-children">
              <button
                type="button"
                className={`sidebar-child ${activeSubtab === 'orders' ? 'active' : ''}`}
                onClick={() => onSubtabChange('orders')}
              >
                Orders
              </button>
              <button
                type="button"
                className={`sidebar-child ${activeSubtab === 'routes' ? 'active' : ''}`}
                onClick={() => onSubtabChange('routes')}
              >
                Routes
              </button>
              <button
                type="button"
                className={`sidebar-child ${activeSubtab === 'timeline' ? 'active' : ''}`}
                onClick={() => onSubtabChange('timeline')}
              >
                Timeline
              </button>
            </div>
          )}
        </div>

        {/* Live Tracking */}
        <button
          type="button"
          className={`sidebar-item ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => onTabChange('live')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 12a7 7 0 0 1 14 0" />
            <path d="M2 12a10 10 0 0 1 20 0" />
            <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
          </svg>
          <span>Live</span>
        </button>

        {/* Analytics */}
        <div className="nav-group">
          <button
            type="button"
            className={`sidebar-item ${isAnalyticsOpen ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 20V10M12 20V4M20 20v-7" />
            </svg>
            <span>Analytics</span>
            <svg className="chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {isAnalyticsOpen && (
            <div className="nav-children">
              {analyticsCategories.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`sidebar-child ${analyticsCategory === cat.key ? 'active' : ''}`}
                  onClick={() => onAnalyticsCategoryChange(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings */}
        <button
          type="button"
          className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
          </svg>
          <span>Settings</span>
        </button>
      </nav>

      {/* Sidebar Footer with Status Pills */}
      <div className="sidebar-footer">
        <div className="status-pill" data-state={scenario === 'peak' ? 'peak' : 'normal'}>
          <span className="status-dot"></span>
          <span className="status-label">Scenario · <strong>{scenario === 'peak' ? 'Peak Demand' : 'Normal Demand'}</strong></span>
        </div>
        <div className="status-pill" data-state={isRunning ? 'running' : (isOptimized ? 'optimised' : 'idle')}>
          <span className="status-dot"></span>
          <span className="status-label">Plan · <strong>{isRunning ? 'Running Solver…' : (isOptimized ? 'GreenFlow Optimised' : 'Baseline (Unoptimised)')}</strong></span>
        </div>
      </div>
    </aside>
  )
}
