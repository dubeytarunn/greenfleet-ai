import React, { useState, useEffect } from 'react'

const ROUTE_LAYOUT = {
  R01: { x: 0.72, y: 0.24 },
  R02: { x: 0.58, y: 0.72 },
  R03: { x: 0.82, y: 0.58 },
  R04: { x: 0.22, y: 0.20 },
  R05: { x: 0.30, y: 0.80 },
  R06: { x: 0.46, y: 0.14 },
}
const DEPOT = { x: 0.5, y: 0.5 }

export default function LiveTab({
  vehicles = [],
  routes = [],
  assignment = {},
  orders = [],
  onShowToast,
}) {
  const [liveTick, setLiveTick] = useState(0)
  const [driverPortals, setDriverPortals] = useState({})
  const [harshEventDrivers, setHarshEventDrivers] = useState(new Set())
  const [selectedDriverId, setSelectedDriverId] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTick((t) => t + 1)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  const computeDriverBehaviour = (driverId, tick) => {
    let brakeFreq = 4.2 + (Math.sin(driverId.charCodeAt(2) + tick * 0.4) + 1) * 2.5
    let gearIrregular = 10 + (Math.cos(driverId.charCodeAt(3) + tick * 0.3) + 1) * 8
    let mileage = 9.5 + (Math.sin(tick * 0.2) + 1) * 3
    let harshAccel = Math.round((Math.sin(driverId.charCodeAt(1) + tick * 0.5) + 1) * 1.5)

    if (harshEventDrivers.has(driverId)) {
      brakeFreq = 14.5
      gearIrregular = 65
      harshAccel = 6
    }

    let score = 100 - brakeFreq * 3 - gearIrregular * 0.6 - harshAccel * 4 + (mileage - 10) * 1.5
    score = Math.max(25, Math.min(98, Math.round(score)))
    return { brakeFreq, gearIrregular, mileage, harshAccel, score }
  }

  const handleCreatePortal = (vehicleId) => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let pw = ''
    for (let i = 0; i < 8; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setDriverPortals((prev) => ({
      ...prev,
      [vehicleId]: {
        username: `${vehicleId.toLowerCase()}@greenflow.fleet`,
        password: pw,
      },
    }))
    const v = vehicles.find((x) => x.id === vehicleId)
    if (onShowToast) onShowToast(`Driver Portal created for ${v?.driver || vehicleId}`)
  }

  const handleCopy = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    if (onShowToast) onShowToast('Copied credential to clipboard')
  }

  const selectedVehicle = selectedDriverId ? vehicles.find((v) => v.id === selectedDriverId) : null
  const selectedBehaviour = selectedVehicle ? computeDriverBehaviour(selectedVehicle.id, liveTick) : null
  const selectedAssignedRoutes = selectedVehicle ? (assignment[selectedVehicle.id] || []) : []

  const gaugeColor = (pct) => (pct >= 70 ? '#1E8E3E' : (pct >= 40 ? '#E58A00' : '#D93025'))

  return (
    <main className="tab-panel active">
      <div className="live-grid">
        {/* Left Side: Map & Driver Status Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Map Schematic */}
          <section className="panel">
            <div className="panel-head">
              <h2>Live Fleet Tracking Map</h2>
              <span className="panel-hint">Real-time GPS Simulation Active</span>
            </div>
            <div className="map-schematic" style={{ height: '420px', position: 'relative' }}>
              <svg viewBox="0 0 600 420" style={{ width: '100%', height: '100%' }}>
                {/* Roads */}
                {routes.map((r) => {
                  const p = ROUTE_LAYOUT[r.id] || { x: 0.5, y: 0.2 }
                  return (
                    <path
                      key={`road-${r.id}`}
                      className="map-road"
                      d={`M ${DEPOT.x * 600} ${DEPOT.y * 420} Q ${(DEPOT.x + p.x) / 2 * 600} ${(DEPOT.y + p.y) / 2 * 420 - 24}, ${p.x * 600} ${p.y * 420}`}
                    />
                  )
                })}

                {/* Central Depot */}
                <circle className="map-depot" cx={DEPOT.x * 600} cy={DEPOT.y * 420} r={7} fill="#1C1C1E" />
                <text className="map-vehicle-label" x={DEPOT.x * 600 + 10} y={DEPOT.y * 420 + 4}>DEPOT</text>

                {/* Route Destinations */}
                {routes.map((r) => {
                  const p = ROUTE_LAYOUT[r.id] || { x: 0.5, y: 0.2 }
                  const isCovered = vehicles.some((v) => (assignment[v.id] || []).includes(r.id))
                  return (
                    <g key={`dest-${r.id}`}>
                      <circle cx={p.x * 600} cy={p.y * 420} r={5.5} fill={isCovered ? '#1E8E3E' : '#D93025'} />
                      <text className="map-vehicle-label" x={p.x * 600 + 9} y={p.y * 420 + 3}>{r.id}</text>
                    </g>
                  )
                })}

                {/* Animated Moving Vehicles */}
                {vehicles.map((v, i) => {
                  const assigned = (assignment[v.id] || [])[0]
                  if (!assigned) return null
                  const p = ROUTE_LAYOUT[assigned] || { x: 0.5, y: 0.2 }
                  const t = (Math.sin((liveTick / 6) + i * 1.5) + 1) / 2
                  const x = DEPOT.x * 600 + (p.x * 600 - DEPOT.x * 600) * t
                  const y = DEPOT.y * 420 + (p.y * 420 - DEPOT.y * 420) * t - Math.sin(t * Math.PI) * 20

                  return (
                    <g key={`live-veh-${v.id}`}>
                      <circle className="map-vehicle-dot" cx={x} cy={y} r={5.5} fill="#1E8E3E" />
                      <text className="map-vehicle-label" x={x + 8} y={y - 6}>{v.id}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </section>

          {/* All Drivers Table */}
          <section className="panel">
            <div className="panel-head">
              <h2>All Drivers — Live Fleet Manager View</h2>
            </div>
            <div className="table-scroll" style={{ maxHeight: '280px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>Driving Score</th>
                    <th>ETA next stop</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const assigned = (assignment[v.id] || [])[0]
                    const b = computeDriverBehaviour(v.id, liveTick)
                    const status = assigned ? 'en_route' : 'idle'
                    const speed = assigned ? Math.round(35 + (Math.sin(liveTick + v.id.charCodeAt(2)) + 1) * 15) : 0
                    const eta = assigned ? Math.round(5 + (Math.cos(liveTick + v.id.charCodeAt(3)) + 1) * 8) : null

                    return (
                      <tr
                        key={v.id}
                        className={selectedDriverId === v.id ? 'selected' : ''}
                        onClick={() => setSelectedDriverId(v.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <span className="row-name">{v.driver}</span>
                          <span className="row-sub">{v.id}{assigned ? ` · ${assigned}` : ''}</span>
                        </td>
                        <td>
                          <span className={`driver-status-tag driver-status-${status}`}>
                            {status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="mono">{assigned ? `${speed} km/h` : '—'}</td>
                        <td className={`mono kpi-delta ${b.score >= 70 ? 'good' : (b.score >= 45 ? 'neutral' : 'bad')}`}>
                          {b.score}
                        </td>
                        <td className="mono">{eta !== null ? `${eta} min` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Side: Driver Portal Access & Driver Detail */}
        <div className="live-side-panel">
          {/* Driver Portal Access */}
          <section className="panel">
            <div className="panel-head">
              <h2>Driver Portal Access</h2>
            </div>
            <div className="panel-body">
              <p className="insight-copy" style={{ marginBottom: '10px' }}>
                Generate driver mobile access credentials to broadcast turn-by-turn routes and eco-driving alerts.
              </p>
              <div className="driver-list">
                {vehicles.map((v) => {
                  const portal = driverPortals[v.id]
                  const isSelected = selectedDriverId === v.id

                  return (
                    <div
                      key={v.id}
                      className={`driver-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedDriverId(v.id)}
                    >
                      <div className="driver-avatar">{v.driver.slice(-2)}</div>
                      <div className="driver-row-main">
                        <div className="driver-row-name">{v.driver}</div>
                        <div className="driver-row-sub">{v.id} · {v.type}</div>
                        {portal && (
                          <div className="credential-card">
                            <div className="credential-row">
                              <span>Username</span>
                              <span>{portal.username}</span>
                              <button
                                type="button"
                                className="copy-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(portal.username)
                                }}
                              >
                                Copy
                              </button>
                            </div>
                            <div className="credential-row">
                              <span>Temp password</span>
                              <span>{portal.password}</span>
                              <button
                                type="button"
                                className="copy-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopy(portal.password)
                                }}
                              >
                                Copy
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {portal ? (
                        <span className="driver-status-tag driver-status-en_route">Portal live</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCreatePortal(v.id)
                          }}
                          style={{ padding: '5px 10px', fontSize: '11px' }}
                        >
                          Create Portal
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Driver Detail & Behavior Score */}
          <section className="panel">
            <div className="panel-head">
              <h2>Live Driver Telemetry &amp; Coaching</h2>
            </div>
            <div className="panel-body">
              {selectedVehicle && selectedBehaviour ? (
                <>
                  <div className="score-ring-wrap">
                    <div className="score-ring-num" style={{ color: gaugeColor(selectedBehaviour.score) }}>
                      {selectedBehaviour.score}
                    </div>
                    <div>
                      <div className="toggle-row-text">Driving Score</div>
                      <div className="score-ring-text">Composite metric of braking, gear regularity, and throttle</div>
                    </div>
                  </div>

                  <div className="behaviour-grid">
                    <div className="gauge-card">
                      <div className="gauge-label">Brake frequency</div>
                      <div className="gauge-value">{selectedBehaviour.brakeFreq.toFixed(1)}/10km</div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, selectedBehaviour.brakeFreq * 7)}%`,
                            background: gaugeColor(100 - selectedBehaviour.brakeFreq * 7),
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Gear irregularity</div>
                      <div className="gauge-value">{selectedBehaviour.gearIrregular.toFixed(0)}%</div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${selectedBehaviour.gearIrregular}%`,
                            background: gaugeColor(100 - selectedBehaviour.gearIrregular),
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Instantaneous Economy</div>
                      <div className="gauge-value">{selectedBehaviour.mileage.toFixed(1)} km/L</div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, selectedBehaviour.mileage * 6)}%`,
                            background: gaugeColor(selectedBehaviour.mileage * 6),
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Harsh acceleration</div>
                      <div className="gauge-value">{selectedBehaviour.harshAccel}</div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, selectedBehaviour.harshAccel * 25)}%`,
                            background: gaugeColor(100 - selectedBehaviour.harshAccel * 25),
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {selectedBehaviour.score < 55 ? (
                    <div className="adaptive-note" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                      ⚠ Driving score dropped below threshold — active route re-sequencing recommended to insert rest buffer.
                    </div>
                  ) : (
                    <div className="adaptive-note">
                      Route is stable. If this driver's score drops, GreenFlow AI re-sequences stops automatically.
                    </div>
                  )}

                  <h3 style={{ marginTop: '14px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                    Active Assigned Stops
                  </h3>
                  <ul className="risk-list">
                    {selectedAssignedRoutes.length > 0 ? (
                      selectedAssignedRoutes.map((rid) => {
                        const rOrders = orders.filter((o) => o.route === rid)
                        return rOrders.map((o) => (
                          <li key={o.id} className="risk-item">
                            <span className="risk-id">{o.id}</span>
                            <span className="risk-reason">{o.loc} · {o.dur} min</span>
                          </li>
                        ))
                      })
                    ) : (
                      <li className="risk-empty">No active stops assigned.</li>
                    )}
                  </ul>

                  {harshEventDrivers.has(selectedVehicle.id) ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setHarshEventDrivers((prev) => {
                          const next = new Set(prev)
                          next.delete(selectedVehicle.id)
                          return next
                        })
                        if (onShowToast) onShowToast(`${selectedVehicle.driver} restored to normal monitoring`)
                      }}
                      style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                    >
                      Clear Event — Resume Normal Monitoring
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-amber"
                      onClick={() => {
                        setHarshEventDrivers((prev) => new Set(prev).add(selectedVehicle.id))
                        if (onShowToast) onShowToast(`Harsh driving event simulated for ${selectedVehicle.driver}`)
                      }}
                      style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                    >
                      Simulate Harsh Driving Event
                    </button>
                  )}
                </>
              ) : (
                <p className="detail-empty">
                  Select a driver above to inspect live telematics, driving score gauges, and adaptive coaching.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
