import React, { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEPOT = [13.0350, 80.2100] // GreenFlow depot (central hub, Chennai)

// Deterministically spreads a route around the depot from its route_id, so
// every route gets a stable map position regardless of which ID scheme is
// active (R01.. in the offline fallback, R001../R013_PEAK.. from the real
// backend scenario data) — a fixed lookup table broke silently whenever the
// ID format didn't match, collapsing every route's line onto the depot.
function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function routeCoord(routeId) {
  const h = hashCode(routeId)
  const angle = (h % 360) * (Math.PI / 180)
  const distance = 0.035 + ((h >> 8) % 100) / 100 * 0.06 // ~4-11km ring around the depot
  return [DEPOT[0] + Math.sin(angle) * distance, DEPOT[1] + Math.cos(angle) * distance]
}

function vehicleIcon(color) {
  return L.divIcon({
    className: 'map-vehicle-icon',
    html: `<span style="background:${color}" class="map-vehicle-icon-dot"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

// Re-centers/zooms the map when the selected driver (and therefore the set
// of visible routes) changes, so filtering to one route is actually legible.
function MapViewController({ focusCoord }) {
  const map = useMap()
  useEffect(() => {
    if (focusCoord) {
      map.flyTo(focusCoord, 13, { duration: 0.6 })
    } else {
      map.flyTo(DEPOT, 11, { duration: 0.6 })
    }
  }, [focusCoord, map])
  return null
}

export default function LiveTab({
  vehicles = [],
  routes = [],
  assignment = {},
  orders = [],
  onShowToast,
  onSimulateHarshEvent,
  onClearHarshEvent,
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

  // When a driver is selected, the map shows only their route; otherwise
  // every route/vehicle is shown. Recomputes whenever assignment changes
  // (peak demand, re-optimize, telemetry-driven reroute) so the map stays live.
  const visibleRoutes = selectedVehicle
    ? routes.filter((r) => selectedAssignedRoutes.includes(r.id))
    : routes
  const visibleVehicles = selectedVehicle
    ? vehicles.filter((v) => v.id === selectedVehicle.id)
    : vehicles
  const focusCoord = selectedVehicle && selectedAssignedRoutes[0]
    ? routeCoord(selectedAssignedRoutes[0])
    : null

  const gaugeColor = (pct) => (pct >= 70 ? '#1E8E3E' : (pct >= 40 ? '#E58A00' : '#D93025'))

  return (
    <main className="tab-panel active">
      <div className="live-grid">
        {/* Left Side: Map & Driver Status Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Live Map */}
          <section className="panel">
            <div className="panel-head">
              <h2>Live Fleet Tracking Map</h2>
              <span className="panel-hint">
                {selectedVehicle
                  ? `Showing ${selectedVehicle.driver}'s route only — click again to show all`
                  : 'Real-time GPS Simulation Active'}
              </span>
            </div>
            <div className="leaflet-map-wrap">
              <MapContainer
                center={DEPOT}
                zoom={11}
                scrollWheelZoom={false}
                style={{ height: '420px', width: '100%' }}
              >
                <MapViewController focusCoord={focusCoord} />
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Depot */}
                <Marker position={DEPOT} icon={vehicleIcon('#1C1C1E')}>
                  <Popup>
                    <div className="map-popup">
                      <strong>DEPOT</strong>
                      <div className="map-popup-sub">GreenFlow AI Fleet Hub</div>
                    </div>
                  </Popup>
                </Marker>

                {/* Route destinations + roads (filtered to the selected driver's route, if any) */}
                {visibleRoutes.map((r) => {
                  const coord = routeCoord(r.id)
                  const isCovered = vehicles.some((v) => (assignment[v.id] || []).includes(r.id))
                  const isFocused = selectedVehicle && selectedAssignedRoutes.includes(r.id)
                  return (
                    <React.Fragment key={`dest-${r.id}`}>
                      <Polyline
                        positions={[DEPOT, coord]}
                        pathOptions={{
                          color: isFocused ? '#1E8E3E' : '#5B6B7F',
                          weight: isFocused ? 4 : 2,
                          opacity: isFocused ? 0.9 : 0.45,
                        }}
                      />
                      <CircleMarker
                        center={coord}
                        radius={isFocused ? 9 : 7}
                        pathOptions={{
                          color: isCovered ? '#1E8E3E' : '#D93025',
                          fillColor: isCovered ? '#1E8E3E' : '#D93025',
                          fillOpacity: 0.9,
                        }}
                      >
                        <Popup>
                          <div className="map-popup">
                            <strong>{r.id} · {r.area}</strong>
                            <div className="map-popup-sub">
                              {isCovered ? 'Covered' : 'Unassigned'} · {r.demand} units · {r.priority}
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    </React.Fragment>
                  )
                })}

                {/* Animated live vehicles (filtered to the selected driver, if any) */}
                {visibleVehicles.map((v, i) => {
                  const assigned = (assignment[v.id] || [])[0]
                  if (!assigned) return null
                  const coord = routeCoord(assigned)
                  const t = (Math.sin((liveTick / 6) + i * 1.5) + 1) / 2
                  const lat = DEPOT[0] + (coord[0] - DEPOT[0]) * t
                  const lng = DEPOT[1] + (coord[1] - DEPOT[1]) * t
                  const speed = Math.round(35 + (Math.sin(liveTick + v.id.charCodeAt(2)) + 1) * 15)
                  const route = routes.find((r) => r.id === assigned)

                  return (
                    <Marker key={`live-veh-${v.id}`} position={[lat, lng]} icon={vehicleIcon('#1E8E3E')}>
                      <Popup>
                        <div className="map-popup">
                          <strong>{v.id} · Ignition on · {speed} km/h</strong>
                          <div className="map-popup-sub">{v.driver} — {v.type}</div>
                          <div className="map-popup-sub">En route to {route?.area || assigned}, Chennai</div>
                          <div className="map-popup-actions">
                            <button
                              type="button"
                              onClick={() => setSelectedDriverId((prev) => (prev === v.id ? null : v.id))}
                            >
                              {selectedDriverId === v.id ? 'Show All Routes' : 'View Trips'}
                            </button>
                            <button type="button" onClick={() => onShowToast && onShowToast(`ETA shared for ${v.driver}`)}>Share ETA</button>
                            <button type="button" onClick={() => onShowToast && onShowToast(`Route dispatched to ${v.driver}`)}>Dispatch route</button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
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
                        onClick={() => setSelectedDriverId((prev) => (prev === v.id ? null : v.id))}
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
                      onClick={async () => {
                        setHarshEventDrivers((prev) => {
                          const next = new Set(prev)
                          next.delete(selectedVehicle.id)
                          return next
                        })
                        if (onClearHarshEvent) {
                          await onClearHarshEvent(selectedVehicle.id, selectedVehicle.driver)
                        } else if (onShowToast) {
                          onShowToast(`${selectedVehicle.driver} restored to normal monitoring`)
                        }
                      }}
                      style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                    >
                      Clear Event — Resume Normal Monitoring
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-amber"
                      onClick={async () => {
                        setHarshEventDrivers((prev) => new Set(prev).add(selectedVehicle.id))
                        if (onSimulateHarshEvent) {
                          await onSimulateHarshEvent(selectedVehicle.id, selectedVehicle.driver)
                        } else if (onShowToast) {
                          onShowToast(`Harsh driving event simulated for ${selectedVehicle.driver}`)
                        }
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
