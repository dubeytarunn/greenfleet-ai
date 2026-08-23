import React, { useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import api from '../../services/api.js'

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

// Distinct, colorblind-reasonable palette — one color per vehicle, assigned
// deterministically (by ID hash) so a given vehicle always gets the same
// color across re-renders/re-optimizes instead of shifting with array order.
const DRIVER_PALETTE = [
  '#1E8E3E', '#0078D3', '#E58A00', '#8E24AA', '#D93025',
  '#00838F', '#C2185B', '#5B8DEF', '#6D4C41', '#00A896',
]

function driverColor(vehicleId) {
  return DRIVER_PALETTE[hashCode(vehicleId) % DRIVER_PALETTE.length]
}

function vehicleIcon(color) {
  return L.divIcon({
    className: 'map-vehicle-icon',
    html: `<span style="background:${color}" class="map-vehicle-icon-dot"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

// Bends a straight depot->destination line into a gently curved arc (quadratic
// bezier, sampled into a polyline) so it reads as a "route" rather than a
// ruler-straight line — same curve is used in both the all-routes view and
// the single-driver-focused view, just re-styled (thicker/highlighted).
function curvedRoutePath(from, to, bendSign = 1) {
  const midLat = (from[0] + to[0]) / 2
  const midLng = (from[1] + to[1]) / 2
  const dLat = to[0] - from[0]
  const dLng = to[1] - from[1]
  // perpendicular offset, scaled to ~15% of the segment length
  const perpLat = -dLng * 0.15 * bendSign
  const perpLng = dLat * 0.15 * bendSign
  const controlPoint = [midLat + perpLat, midLng + perpLng]

  const points = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const lat = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * controlPoint[0] + t * t * to[0]
    const lng = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * controlPoint[1] + t * t * to[1]
    points.push([lat, lng])
  }
  return points
}

// Public OSRM demo routing server — no API key required. Returns the actual
// road-following geometry (turns included) between two points, snapped to
// the nearest routable road. Used instead of the synthetic bezier curve
// whenever a real path can be fetched; the curve remains a fallback for
// while a fetch is in flight or if OSRM is unreachable/rate-limited.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving'

async function fetchRoadPath(from, to) {
  const url = `${OSRM_BASE}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`OSRM request failed: ${res.status}`)
  const data = await res.json()
  const coords = data?.routes?.[0]?.geometry?.coordinates
  if (!coords || !coords.length) throw new Error('OSRM returned no route geometry')
  return coords.map(([lng, lat]) => [lat, lng]) // GeoJSON is [lng, lat]; Leaflet wants [lat, lng]
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
  const [harshEventDrivers, setHarshEventDrivers] = useState(new Set())
  const [selectedDriverId, setSelectedDriverId] = useState(null)
  const [roadPaths, setRoadPaths] = useState({}) // routeId -> [[lat,lng], ...] real road geometry

  // Real ML Inference State from Model 2 (POST /api/predict/telemetry)
  const [telemetryInferences, setTelemetryInferences] = useState({})
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [telemetryError, setTelemetryError] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTick((t) => t + 1)
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  // Fetch real road-following geometry (with turns) for each route from a
  // public OSRM instance, keyed by route ID so it's only fetched once per
  // route and reused across re-renders/re-optimizes/driver-selection.
  useEffect(() => {
    let cancelled = false
    routes.forEach((r) => {
      if (roadPaths[r.id]) return // already fetched (or in progress this effect run)
      const dest = routeCoord(r.id)
      fetchRoadPath(DEPOT, dest)
        .then((path) => {
          if (!cancelled) setRoadPaths((prev) => (prev[r.id] ? prev : { ...prev, [r.id]: path }))
        })
        .catch(() => {
          // Leave unset — callers fall back to the synthetic curve.
        })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes])

  /**
   * Evaluates telemetry window via backend LightGBM Model 2 (POST /api/predict/telemetry).
   * Sends actual telemetry frames based on current driving conditions.
   */
  const evaluateTelemetryML = useCallback(async (vehicleId, isHarsh) => {
    const v = vehicles.find((x) => x.id === vehicleId) || { id: vehicleId, type: 'Truck', fuel: 'Diesel' }
    
    // Construct real simulated telemetry frames for the ML inference pipeline
    const window = isHarsh
      ? [
          {
            vehicle_id: v.id,
            vehicle_type: v.type,
            fuel_type: v.fuel,
            speed_kmph: 68.0,
            acceleration_mps2: 3.4,
            rpm: 3800.0,
            gear: 2,
            throttle_position_pct: 90.0,
            brake_pressure_pct: 75.0,
            engine_load_pct: 95.0,
            road_slope_pct: 0.0,
            traffic_level: 'High',
            road_type: 'Urban',
            fuel_level_l: 45.0,
            idle_duration_sec: 25,
          },
          {
            vehicle_id: v.id,
            vehicle_type: v.type,
            fuel_type: v.fuel,
            speed_kmph: 74.0,
            acceleration_mps2: 3.8,
            rpm: 4100.0,
            gear: 2,
            throttle_position_pct: 95.0,
            brake_pressure_pct: 85.0,
            engine_load_pct: 98.0,
            road_slope_pct: 0.0,
            traffic_level: 'High',
            road_type: 'Urban',
            fuel_level_l: 44.5,
            idle_duration_sec: 30,
          },
        ]
      : [
          {
            vehicle_id: v.id,
            vehicle_type: v.type,
            fuel_type: v.fuel,
            speed_kmph: 50.0,
            acceleration_mps2: 0.4,
            rpm: 1650.0,
            gear: 4,
            throttle_position_pct: 35.0,
            brake_pressure_pct: 5.0,
            engine_load_pct: 45.0,
            road_slope_pct: 0.0,
            traffic_level: 'Medium',
            road_type: 'Highway',
            fuel_level_l: 48.0,
            idle_duration_sec: 0,
          },
          {
            vehicle_id: v.id,
            vehicle_type: v.type,
            fuel_type: v.fuel,
            speed_kmph: 52.0,
            acceleration_mps2: 0.2,
            rpm: 1700.0,
            gear: 4,
            throttle_position_pct: 32.0,
            brake_pressure_pct: 0.0,
            engine_load_pct: 42.0,
            road_slope_pct: 0.0,
            traffic_level: 'Medium',
            road_type: 'Highway',
            fuel_level_l: 47.8,
            idle_duration_sec: 0,
          },
        ]

    try {
      setTelemetryLoading(true)
      setTelemetryError(null)
      const res = await api.analyzeTelemetry(window)
      if (res && res.vehicle_id) {
        setTelemetryInferences((prev) => ({
          ...prev,
          [vehicleId]: res,
        }))
      }
    } catch (err) {
      console.warn(`[LiveTab] Telemetry ML inference failed for ${vehicleId}:`, err.message)
      setTelemetryError('Telemetry ML inference service currently unreachable.')
    } finally {
      setTelemetryLoading(false)
    }
  }, [vehicles])

  // Trigger real ML evaluation on initial vehicle load or driver selection
  useEffect(() => {
    vehicles.forEach((v) => {
      const isHarsh = harshEventDrivers.has(v.id)
      evaluateTelemetryML(v.id, isHarsh)
    })
  }, [vehicles, harshEventDrivers, evaluateTelemetryML])

  const selectedVehicle = selectedDriverId ? vehicles.find((v) => v.id === selectedDriverId) : null

  const selectedAssignedRoutes = selectedVehicle ? (assignment[selectedVehicle.id] || []) : []
  const selectedMLAlert = selectedVehicle ? telemetryInferences[selectedVehicle.id] : null

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
  const severityBadgeClass = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL': return 'driver-status-break'
      case 'WARNING': return 'driver-status-idle'
      default: return 'driver-status-en_route'
    }
  }

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

                {/* Route destinations + roads */}
                {visibleRoutes.map((r) => {
                  const bendSign = hashCode(r.id) % 2 === 0 ? 1 : -1
                  const fallbackDest = routeCoord(r.id)
                  const path = roadPaths[r.id] || curvedRoutePath(DEPOT, fallbackDest, bendSign)
                  const coord = path[path.length - 1]
                  const assignedVehicle = vehicles.find((v) => (assignment[v.id] || []).includes(r.id))
                  const isCovered = Boolean(assignedVehicle)
                  const isFocused = selectedVehicle && selectedAssignedRoutes.includes(r.id)
                  const routeColor = assignedVehicle ? driverColor(assignedVehicle.id) : '#8A96A6'
                  return (
                    <React.Fragment key={`dest-${r.id}`}>
                      <Polyline
                        positions={path}
                        pathOptions={{
                          color: routeColor,
                          weight: isFocused ? 5 : 3,
                          opacity: isFocused ? 0.95 : (isCovered ? 0.65 : 0.35),
                          dashArray: isCovered ? null : '6 6',
                        }}
                      />
                      <CircleMarker
                        center={coord}
                        radius={isFocused ? 9 : 7}
                        pathOptions={{
                          color: routeColor,
                          fillColor: routeColor,
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

                {/* Animated live vehicles on map */}
                {visibleVehicles.map((v, i) => {
                  const assigned = (assignment[v.id] || [])[0]
                  if (!assigned) return null
                  const bendSign = hashCode(assigned) % 2 === 0 ? 1 : -1
                  const path = roadPaths[assigned] || curvedRoutePath(DEPOT, routeCoord(assigned), bendSign)
                  const t = (Math.sin((liveTick / 6) + i * 1.5) + 1) / 2
                  const [lat, lng] = path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))]
                  const speed = Math.round(35 + (Math.sin(liveTick + v.id.charCodeAt(2)) + 1) * 15)
                  const route = routes.find((r) => r.id === assigned)
                  const color = driverColor(v.id)

                  return (
                    <Marker key={`live-veh-${v.id}`} position={[lat, lng]} icon={vehicleIcon(color)}>
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

          {/* All Drivers Table — populated with Model 2 ML scores */}
          <section className="panel">
            <div className="panel-head">
              <h2>All Drivers — Live Fleet Manager View</h2>
              <span className="panel-hint">ML Model 2 Continuous Telemetry</span>
            </div>
            <div className="table-scroll" style={{ maxHeight: '280px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>Driving Score (ML)</th>
                    <th>ETA next stop</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => {
                    const assigned = (assignment[v.id] || [])[0]
                    const mlAlert = telemetryInferences[v.id]
                    const score = mlAlert ? mlAlert.behaviour_score : 95.0
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
                        <td className={`mono kpi-delta ${score >= 70 ? 'good' : (score >= 45 ? 'neutral' : 'bad')}`}>
                          {score.toFixed(0)}
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

        {/* Right Side: Live Driver Telemetry & ML Coaching */}
        <div className="live-side-panel">
          {/* Driver Detail & Real Model 2 Behavior Score */}
          <section className="panel">
            <div className="panel-head">
              <h2>Live Driver Telemetry &amp; Coaching</h2>
              {telemetryLoading && <span className="panel-hint">Evaluating Model 2…</span>}
            </div>
            <div className="panel-body">
              {selectedVehicle ? (
                <>
                  <div className="score-ring-wrap">
                    <div className="score-ring-num" style={{ color: gaugeColor(selectedMLAlert?.behaviour_score ?? 95) }}>
                      {selectedMLAlert ? selectedMLAlert.behaviour_score.toFixed(0) : '95'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="toggle-row-text">Driving Score</span>
                        <span className={`driver-status-tag ${severityBadgeClass(selectedMLAlert?.severity)}`}>
                          {selectedMLAlert?.severity || 'NORMAL'}
                        </span>
                      </div>
                      <div className="score-ring-text">Model 2: LightGBM continuous telemetry analysis</div>
                    </div>
                  </div>

                  <div className="behaviour-grid">
                    <div className="gauge-card">
                      <div className="gauge-label">Detected Behaviour</div>
                      <div className="gauge-value" style={{ fontSize: '13px' }}>
                        {selectedMLAlert?.behaviour ? selectedMLAlert.behaviour.replace('_', ' ').toUpperCase() : 'NORMAL'}
                      </div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: selectedMLAlert?.behaviour === 'normal' ? '100%' : '35%',
                            background: selectedMLAlert?.behaviour === 'normal' ? '#1E8E3E' : '#D93025',
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Fuel Waste vs Baseline</div>
                      <div className="gauge-value">
                        {selectedMLAlert ? `${selectedMLAlert.fuel_wasted_l.toFixed(2)} L` : '0.00 L'}
                      </div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, Math.max(5, (selectedMLAlert?.fuel_deviation_pct || 0) * 2))}%`,
                            background: (selectedMLAlert?.fuel_deviation_pct || 0) > 15 ? '#D93025' : '#1E8E3E',
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Excess Financial &amp; CO₂</div>
                      <div className="gauge-value" style={{ fontSize: '12px' }}>
                        {selectedMLAlert ? `₹${selectedMLAlert.estimated_cost_inr.toFixed(0)} · ${selectedMLAlert.co2_impact_kg.toFixed(1)}kg` : '₹0 · 0kg'}
                      </div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, Math.max(5, (selectedMLAlert?.estimated_cost_inr || 0) * 3))}%`,
                            background: (selectedMLAlert?.estimated_cost_inr || 0) > 10 ? '#D93025' : '#1E8E3E',
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className="gauge-card">
                      <div className="gauge-label">Remaining Range (ML)</div>
                      <div className="gauge-value" style={{ fontSize: '13px' }}>
                        {selectedMLAlert ? `${selectedMLAlert.remaining_range_km.toFixed(0)} km` : '150 km'}
                      </div>
                      <div className="gauge-track">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${Math.min(100, ((selectedMLAlert?.remaining_range_km || 150) / 300) * 100)}%`,
                            background: (selectedMLAlert?.remaining_range_km || 150) < 40 ? '#D93025' : '#1E8E3E',
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {telemetryError ? (
                    <div className="adaptive-note" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}>
                      {telemetryError}
                    </div>
                  ) : selectedMLAlert?.message ? (
                    <div
                      className="adaptive-note"
                      style={{
                        borderColor: selectedMLAlert.severity === 'CRITICAL' ? 'var(--accent-red)' : selectedMLAlert.severity === 'WARNING' ? 'var(--accent-amber)' : 'var(--action-primary-light)',
                        color: selectedMLAlert.severity === 'CRITICAL' ? 'var(--accent-red)' : 'inherit',
                      }}
                    >
                      {selectedMLAlert.message}
                    </div>
                  ) : null}

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
                        await evaluateTelemetryML(selectedVehicle.id, false)
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
                        await evaluateTelemetryML(selectedVehicle.id, true)
                        if (onSimulateHarshEvent) {
                          await onSimulateHarshEvent(selectedVehicle.id, selectedVehicle.driver)
                        } else if (onShowToast) {
                          onShowToast(`Harsh driving event sent to Model 2 for ${selectedVehicle.driver}`)
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

