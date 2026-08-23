import React, { useState } from 'react'

const TIMELINE_COLORS = ['#1E8E3E', '#E58A00', '#0078D3', '#5B8DEF', '#D93025']

export default function TimelineSubpanel({
  vehicles = [],
  assignment = {},
  orders = [],
}) {
  const [zoom, setZoom] = useState(100)

  const startHour = 8
  const endHour = 14.5
  const totalMinutes = (endHour - startHour) * 60

  const hours = []
  for (let h = startHour; h <= endHour; h += 0.5) {
    const hh = Math.floor(h)
    const mm = h % 1 === 0 ? '00' : '30'
    hours.push(`${String(hh).padStart(2, '0')}:${mm}`)
  }

  return (
    <section className="subpanel active">
      <div className="panel">
        <div className="panel-head">
          <h2>Driver Timeline Schedule</h2>
          <span className="panel-hint">22-08-2026 · Saturday Operations</span>
        </div>
        <div className="panel-body">
          <div className="timeline-toolbar">
            <div className="zoom-row">
              Zoom
              <input
                type="range"
                min="60"
                max="160"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span>{zoom}%</span>
            </div>
          </div>

          <div className="timeline-wrap">
            <div className="timeline-grid">
              {/* Header Track */}
              <div className="timeline-header">
                <div className="timeline-header-label">Driver</div>
                <div className="timeline-header-track">
                  {hours.map((timeStr) => (
                    <div key={timeStr} className="timeline-hour">{timeStr}</div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {vehicles.map((v, vi) => {
                const routeIds = assignment[v.id] || []
                let cursorMin = 0
                const blocks = []

                routeIds.forEach((rid) => {
                  const assignedOrders = orders.filter((o) => o.route === rid)
                  assignedOrders.forEach((o) => {
                    const leftPct = (cursorMin / totalMinutes) * 100
                    const widthPct = (o.dur / totalMinutes) * 100 * (zoom / 100)
                    blocks.push(
                      <div
                        key={o.id}
                        className="timeline-block"
                        style={{
                          left: `${leftPct}%`,
                          width: `${Math.max(widthPct, 2)}%`,
                          background: TIMELINE_COLORS[vi % TIMELINE_COLORS.length],
                        }}
                        title={`${o.id} · ${o.loc} · ${o.dur} min`}
                      >
                        {o.id.slice(-2)}
                      </div>
                    )
                    cursorMin += o.dur + 2
                  })
                })

                return (
                  <div key={v.id} className="timeline-row">
                    <div className="timeline-row-label">
                      <span
                        className="dot"
                        style={{ background: TIMELINE_COLORS[vi % TIMELINE_COLORS.length] }}
                      ></span>
                      {v.driver}
                    </div>
                    <div className="timeline-row-track">
                      {blocks.length > 0 ? (
                        blocks
                      ) : (
                        <span className="detail-empty" style={{ paddingLeft: '8px', lineHeight: '42px' }}>
                          No stops assigned
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
