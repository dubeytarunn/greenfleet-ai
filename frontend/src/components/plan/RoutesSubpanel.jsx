import React, { useState } from 'react'

export default function RoutesSubpanel({
  vehicles = [],
  routes = [],
  assignment = {},
  baselineAssignment = {},
  isOptimized = false,
  scenario = 'normal',
  kpis = {},
  baselineKpis = {},
  solverLogs = [],
  selectedVehicleId = null,
  selectedRouteId = null,
  onSelectVehicle,
  onSelectRoute,
}) {
  const [vehicleFilter, setVehicleFilter] = useState('all')

  const isVehicleAvailable = (v) => {
    if (v.id === 'V005' && scenario === 'peak') return false
    return v.availableNormally !== false
  }

  const getVehicleStatusKey = (v) => {
    if (!isVehicleAvailable(v)) return 'maintenance'
    return (assignment[v.id] || []).length > 0 ? 'on_route' : 'available'
  }

  const filteredVehicles = vehicles.filter((v) => {
    if (vehicleFilter === 'all') return true
    return getVehicleStatusKey(v) === vehicleFilter
  })

  // Selected Detail Card
  const selectedVehicle = selectedVehicleId ? vehicles.find((v) => v.id === selectedVehicleId) : null
  const selectedRoute = selectedRouteId ? routes.find((r) => r.id === selectedRouteId) : null

  // Constraint verification evaluation
  const maxRoutesPerVehicle = scenario === 'peak' ? 2 : 1
  const routeCoverage = {}
  routes.forEach((r) => { routeCoverage[r.id] = 0 })
  vehicles.forEach((v) => {
    (assignment[v.id] || []).forEach((rid) => {
      routeCoverage[rid] = (routeCoverage[rid] || 0) + 1
    })
  })

  const everyRouteAssigned = routes.every((r) => routeCoverage[r.id] === 1)
  const noDoubleBooking = vehicles.every((v) => (assignment[v.id] || []).length <= maxRoutesPerVehicle)
  const noUnavailableUsed = vehicles.every((v) => isVehicleAvailable(v) || (assignment[v.id] || []).length === 0)
  const capacityViolations = []
  vehicles.forEach((v) => {
    (assignment[v.id] || []).forEach((rid) => {
      const route = routes.find((r) => r.id === rid)
      if (route && v.capacity < route.demand) capacityViolations.push(`${v.id}→${rid}`)
    })
  })
  const noCapacityViolations = capacityViolations.length === 0

  // High risk list
  const riskyItems = []
  vehicles.forEach((v) => {
    if (!isVehicleAvailable(v)) {
      riskyItems.push({ id: v.id, reason: 'In maintenance — excluded from assignment' })
    }
    (assignment[v.id] || []).forEach((rid) => {
      const r = routes.find((x) => x.id === rid)
      if (r && v.capacity < r.demand) {
        riskyItems.push({ id: v.id, reason: `Under capacity for ${r.id} (${v.capacity} < ${r.demand} boxes)` })
      }
    })
  })
  routes.forEach((r) => {
    if (routeCoverage[r.id] === 0) {
      riskyItems.push({ id: r.id, reason: 'Route unassigned — no vehicle covers it' })
    }
  })

  // SVG Graph Layout Dimensions
  const svgW = 640
  const svgH = 360
  const vGap = svgH / (vehicles.length + 1)
  const rGap = svgH / (routes.length + 1)
  const vX = 46
  const rX = svgW - 46

  return (
    <section className="subpanel active">
      {/* 1. KPI Strip */}
      <section className="kpi-strip" aria-label="Key performance indicators">
        {/* Fuel Consumption */}
        <div className="kpi-card">
          <span className="kpi-label">Fuel Consumption</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{(kpis.fuelL || 0).toFixed(1)}</span>
            <span className="kpi-unit">L</span>
          </div>
          {isOptimized ? (
            <span className="kpi-delta good">↓ {Math.abs(((kpis.fuelL - baselineKpis.fuelL) / (baselineKpis.fuelL || 1)) * 100).toFixed(1)}% vs baseline</span>
          ) : (
            <span className="kpi-delta neutral">—</span>
          )}
        </div>

        {/* Estimated CO2 */}
        <div className="kpi-card">
          <span className="kpi-label">Estimated CO₂</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{(kpis.co2Kg || 0).toFixed(1)}</span>
            <span className="kpi-unit">kg</span>
          </div>
          {isOptimized ? (
            <span className="kpi-delta good">↓ {Math.abs(((kpis.co2Kg - baselineKpis.co2Kg) / (baselineKpis.co2Kg || 1)) * 100).toFixed(1)}% vs baseline</span>
          ) : (
            <span className="kpi-delta neutral">—</span>
          )}
        </div>

        {/* Operating Cost */}
        <div className="kpi-card">
          <span className="kpi-label">Operating Cost</span>
          <div className="kpi-value-row">
            <span className="kpi-value">₹{(kpis.costINR || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          {isOptimized ? (
            <span className="kpi-delta good">↓ {Math.abs(((kpis.costINR - baselineKpis.costINR) / (baselineKpis.costINR || 1)) * 100).toFixed(1)}% vs baseline</span>
          ) : (
            <span className="kpi-delta neutral">—</span>
          )}
        </div>

        {/* Fleet Utilisation */}
        <div className="kpi-card">
          <span className="kpi-label">Fleet Utilisation</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{(kpis.utilisationPct || 0).toFixed(0)}</span>
            <span className="kpi-unit">%</span>
          </div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: `${Math.min(100, kpis.utilisationPct || 0)}%` }}></div>
          </div>
        </div>

        {/* Fuel Saved */}
        <div className="kpi-card">
          <span className="kpi-label">Fuel Saved</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{Math.max(0, (baselineKpis.fuelL || 0) - (kpis.fuelL || 0)).toFixed(1)}</span>
            <span className="kpi-unit">L</span>
          </div>
          <span className={`kpi-delta ${isOptimized ? 'good' : 'neutral'}`}>
            {isOptimized ? 'since optimization' : 'run solver to see savings'}
          </span>
        </div>

        {/* Inefficient Trips */}
        <div className="kpi-card">
          <span className="kpi-label">Inefficient Trips</span>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis.inefficientTrips || 0}</span>
          </div>
          <span className={`kpi-delta ${kpis.inefficientTrips === 0 ? 'good' : 'bad'}`}>
            {kpis.inefficientTrips === 0 ? 'Optimal match' : `${kpis.inefficientTrips} flag(s)`}
          </span>
        </div>
      </section>

      {/* 2. Workspace 3-Column Layout */}
      <div className="workspace">
        {/* Column 1: Fleet Inventory Table */}
        <section className="panel panel-fleet" aria-label="Fleet inventory">
          <div className="panel-head">
            <h2>Routes &amp; Drivers</h2>
          </div>
          <div className="panel-body">
            <div className="filter-row">
              {['all', 'available', 'on_route', 'maintenance'].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`chip ${vehicleFilter === filter ? 'active' : ''}`}
                  onClick={() => setVehicleFilter(filter)}
                >
                  {filter.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Driver / Vehicle</th>
                    <th>Distance</th>
                    <th># Stops</th>
                    <th>Load</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVehicles.map((v) => {
                    const assignedRoutes = assignment[v.id] || []
                    const statusKey = getVehicleStatusKey(v)
                    const totalDist = assignedRoutes.reduce((sum, rid) => {
                      const r = routes.find((x) => x.id === rid)
                      return sum + (r ? r.distanceKm : 0)
                    }, 0)
                    const isSelected = selectedVehicleId === v.id

                    return (
                      <tr
                        key={v.id}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => onSelectVehicle(v.id)}
                      >
                        <td><span className={`dot dot-${statusKey}`}></span></td>
                        <td>
                          <span className="row-name">{v.driver}</span>
                          <span className="row-sub">{v.id} · {v.type}</span>
                        </td>
                        <td className="mono">{assignedRoutes.length ? `${totalDist.toFixed(1)} km` : '—'}</td>
                        <td className="mono">{assignedRoutes.length}</td>
                        <td className="mono">
                          {assignedRoutes.length > 1
                            ? `${assignedRoutes.length} trips`
                            : (assignedRoutes.length ? `${Math.round(((routes.find(r => r.id === assignedRoutes[0])?.demand || 0) / v.capacity) * 100)}%` : '—')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-foot">
            {selectedVehicle ? (
              <div className="detail-card">
                <span className="detail-title">{selectedVehicle.driver} · {selectedVehicle.id}</span>
                <div className="detail-grid">
                  <div className="detail-item">Type<b>{selectedVehicle.type}</b></div>
                  <div className="detail-item">Fuel<b>{selectedVehicle.fuel}</b></div>
                  <div className="detail-item">Capacity<b>{selectedVehicle.capacity} boxes</b></div>
                  <div className="detail-item">Efficiency<b>{selectedVehicle.efficiency} km/L</b></div>
                  <div className="detail-item">Status<b>{isVehicleAvailable(selectedVehicle) ? 'Available' : 'Maintenance'}</b></div>
                  <div className="detail-item">Assigned<b>{(assignment[selectedVehicle.id] || []).join(', ') || 'None'}</b></div>
                </div>
              </div>
            ) : selectedRoute ? (
              <div className="detail-card">
                <span className="detail-title">{selectedRoute.id} · {selectedRoute.area}</span>
                <div className="detail-grid">
                  <div className="detail-item">Distance<b>{selectedRoute.distanceKm} km</b></div>
                  <div className="detail-item">Demand<b>{selectedRoute.demand} boxes</b></div>
                  <div className="detail-item">Traffic<b>{selectedRoute.traffic}</b></div>
                  <div className="detail-item">Priority<b>{selectedRoute.priority}</b></div>
                </div>
              </div>
            ) : (
              <p className="detail-empty">Select a vehicle or route above to inspect its full operational profile.</p>
            )}
          </div>
        </section>

        {/* Column 2: Bipartite Assignment Graph */}
        <section className="panel panel-graph" aria-label="Vehicle to route assignment">
          <div className="panel-head">
            <h2>Vehicle → Route Assignment</h2>
            <div className="legend">
              <span className="legend-item"><i className="swatch swatch-good"></i>Efficient</span>
              <span className="legend-item"><i className="swatch swatch-warn"></i>Marginal</span>
              <span className="legend-item"><i className="swatch swatch-bad"></i>Constraint risk</span>
              <span className="legend-item"><i className="swatch swatch-none"></i>Unassigned</span>
            </div>
          </div>

          <div className="graph-wrap">
            <div className="graph-col-label graph-col-label-left">FLEET</div>
            <svg id="assignment-svg" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none">
              {/* Edges */}
              {vehicles.map((v, i) => {
                const y1 = vGap * (i + 1)
                const assigned = assignment[v.id] || []

                return assigned.map((rid) => {
                  const rIdx = routes.findIndex((r) => r.id === rid)
                  if (rIdx === -1) return null
                  const y2 = rGap * (rIdx + 1)
                  const route = routes[rIdx]
                  const isHighlighted = selectedVehicleId === v.id || selectedRouteId === rid
                  const midX = (vX + rX) / 2

                  let stroke = '#1E8E3E'
                  if (v.capacity < route.demand) stroke = '#D93025'

                  return (
                    <path
                      key={`${v.id}-${rid}`}
                      className="edge-line"
                      d={`M ${vX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${rX} ${y2}`}
                      stroke={stroke}
                      strokeWidth={isHighlighted ? 3.2 : 1.6}
                      opacity={isHighlighted ? 1 : 0.65}
                      onClick={() => onSelectVehicle(v.id)}
                    />
                  )
                })
              })}

              {/* Unassigned dashed lines */}
              {routes.map((r, i) => {
                const isCovered = vehicles.some((v) => (assignment[v.id] || []).includes(r.id))
                if (isCovered) return null
                const y = rGap * (i + 1)
                return (
                  <line
                    key={`unassigned-${r.id}`}
                    x1={rX - 26}
                    y1={y}
                    x2={rX - 10}
                    y2={y}
                    stroke="#D93025"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    opacity="0.8"
                  />
                )
              })}

              {/* Vehicle Left Nodes */}
              {vehicles.map((v, i) => {
                const y = vGap * (i + 1)
                const available = isVehicleAvailable(v)
                const isSelected = selectedVehicleId === v.id

                return (
                  <g key={`vnode-${v.id}`} onClick={() => onSelectVehicle(v.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      className="node-dot"
                      cx={vX}
                      cy={y}
                      r={isSelected ? 7 : 5.5}
                      fill={available ? '#1E8E3E' : '#8A96A6'}
                      opacity={available ? 1 : 0.45}
                    />
                    <text
                      className={`node-label ${isSelected ? 'node-label-selected' : ''}`}
                      x={vX - 12}
                      y={y + 4}
                      textAnchor="end"
                    >
                      {v.id}
                    </text>
                  </g>
                )
              })}

              {/* Route Right Nodes */}
              {routes.map((r, i) => {
                const y = rGap * (i + 1)
                const isSelected = selectedRouteId === r.id
                const isCovered = vehicles.some((v) => (assignment[v.id] || []).includes(r.id))

                return (
                  <g key={`rnode-${r.id}`} onClick={() => onSelectRoute(r.id)} style={{ cursor: 'pointer' }}>
                    <circle
                      className="node-dot"
                      cx={rX}
                      cy={y}
                      r={isSelected ? 7 : 5.5}
                      fill={isCovered ? '#0078D3' : '#D93025'}
                    />
                    <text
                      className={`node-label ${isSelected ? 'node-label-selected' : ''}`}
                      x={rX + 12}
                      y={y + 4}
                      textAnchor="start"
                    >
                      {r.id}
                    </text>
                  </g>
                )
              })}
            </svg>
            <div className="graph-col-label graph-col-label-right">ROUTES</div>
          </div>

          <div className="panel-head panel-head-tight">
            <h2>Optimization Efficiency Summary</h2>
            <span className="panel-hint">Calculated across current vehicle-route pairings</span>
          </div>
          <div className="panel-body" style={{ paddingBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="gauge-card">
                <div className="gauge-label">Baseline Fuel Burn</div>
                <div className="gauge-value">{(baselineKpis.fuelL || 0).toFixed(1)} L</div>
                <div className="gauge-track">
                  <div className="gauge-fill" style={{ width: '100%', background: '#8A96A6' }}></div>
                </div>
              </div>
              <div className="gauge-card">
                <div className="gauge-label">Optimized Fuel Burn</div>
                <div className="gauge-value" style={{ color: '#1E8E3E' }}>{(kpis.fuelL || 0).toFixed(1)} L</div>
                <div className="gauge-track">
                  <div
                    className="gauge-fill"
                    style={{
                      width: `${Math.min(100, ((kpis.fuelL || 1) / (baselineKpis.fuelL || 1)) * 100)}%`,
                      background: '#1E8E3E',
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Column 3: Quantum-Inspired Optimization Insight Panel */}
        <section className="panel panel-insight" aria-label="Optimisation insight">
          <div className="panel-head">
            <h2>Quantum-Inspired Optimization</h2>
          </div>

          <div className="insight-block">
            <p className="insight-copy">
              Assignments are formulated as binary decisions <code>x&#8320;&#7522;</code> — vehicle <em>i</em> to route <em>j</em> — over a QUBO-style cost surface combining fuel, emissions, distance and imbalance penalties.
            </p>
            <div className="method-tags">
              <span className="tag">QUBO Assignment</span>
              <span className="tag">Simulated Annealing</span>
              <span className="tag">Constraint-Aware Search</span>
            </div>
          </div>

          <div className="insight-block">
            <h3>Solver Log</h3>
            <ul className="solver-log">
              {solverLogs.length > 0 ? (
                solverLogs.map((log, idx) => (
                  <li key={idx} className="done">{log}</li>
                ))
              ) : (
                <li className="log-idle">Awaiting optimization run.</li>
              )}
            </ul>
          </div>

          <div className="insight-block">
            <h3>Constraint Verification</h3>
            <ul className="checklist">
              <li>
                <span className={`check-icon ${everyRouteAssigned ? 'pass' : 'fail'}`}>{everyRouteAssigned ? '✓' : '!'}</span>
                Every route gets required assignment
              </li>
              <li>
                <span className={`check-icon ${noDoubleBooking ? 'pass' : 'fail'}`}>{noDoubleBooking ? '✓' : '!'}</span>
                No vehicle exceeds maximum route limit
              </li>
              <li>
                <span className={`check-icon ${noUnavailableUsed ? 'pass' : 'fail'}`}>{noUnavailableUsed ? '✓' : '!'}</span>
                Unavailable vehicles are excluded
              </li>
              <li>
                <span className={`check-icon ${noCapacityViolations ? 'pass' : 'fail'}`}>{noCapacityViolations ? '✓' : '!'}</span>
                Vehicle capacity respected on every leg
              </li>
            </ul>
          </div>

          <div className="insight-block">
            <h3>High-Risk Items</h3>
            <ul className="risk-list">
              {riskyItems.length > 0 ? (
                riskyItems.map((item, idx) => (
                  <li key={idx} className="risk-item">
                    <span className="risk-id">{item.id}</span>
                    <span className="risk-reason">{item.reason}</span>
                  </li>
                ))
              ) : (
                <li className="risk-empty">No flagged vehicles or routes.</li>
              )}
            </ul>
          </div>

          <div className="insight-block">
            <h3>Baseline vs Optimised</h3>
            <div className="compare-list">
              <div className="compare-row">
                <div className="compare-row-top">
                  <span>Fuel</span>
                  <b>{(baselineKpis.fuelL || 0).toFixed(1)} → {(kpis.fuelL || 0).toFixed(1)} L</b>
                </div>
                <div className="compare-track">
                  <div className="compare-fill-baseline" style={{ width: '100%' }}></div>
                  <div className="compare-fill-optimised" style={{ width: `${Math.min(100, ((kpis.fuelL || 1) / (baselineKpis.fuelL || 1)) * 100)}%` }}></div>
                </div>
              </div>

              <div className="compare-row">
                <div className="compare-row-top">
                  <span>Operating Cost</span>
                  <b>₹{(baselineKpis.costINR || 0).toFixed(0)} → ₹{(kpis.costINR || 0).toFixed(0)}</b>
                </div>
                <div className="compare-track">
                  <div className="compare-fill-baseline" style={{ width: '100%' }}></div>
                  <div className="compare-fill-optimised" style={{ width: `${Math.min(100, ((kpis.costINR || 1) / (baselineKpis.costINR || 1)) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}
