import React, { useState } from 'react'

export default function OrdersSubpanel({
  orders = [],
  scenario = 'normal',
  onAddOrder,
  onCopyOrders,
  onUnscheduleOrders,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true
    return (
      o.id.toLowerCase().includes(term) ||
      o.loc.toLowerCase().includes(term) ||
      o.route.toLowerCase().includes(term) ||
      o.priority.toLowerCase().includes(term)
    )
  })

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const toggleSelectOrder = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="subpanel active">
      <div className="panel">
        <div className="panel-body" style={{ paddingTop: '14px' }}>
          <div className="toolbar-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onAddOrder}
              style={{ padding: '7px 12px' }}
            >
              + Add order
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCopyOrders}
              style={{ padding: '7px 12px' }}
            >
              Copy orders
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onUnscheduleOrders(Array.from(selectedIds))}
              style={{ padding: '7px 12px' }}
            >
              Unschedule
            </button>
            <div className="divider"></div>
            <input
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter orders…"
            />
          </div>

          <div className="table-scroll" style={{ maxHeight: '560px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '32px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredOrders.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Order ID</th>
                  <th>Priority</th>
                  <th>Location</th>
                  <th>Boxes</th>
                  <th>Duration</th>
                  <th>Route</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length > 0 ? (
                  filteredOrders.map((o) => (
                    <tr
                      key={o.id}
                      className={selectedIds.has(o.id) ? 'selected' : ''}
                      onClick={() => toggleSelectOrder(o.id)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={() => toggleSelectOrder(o.id)}
                        />
                      </td>
                      <td className="mono">{o.id}</td>
                      <td>
                        <span className={`pill-inline pill-${o.priority}`}>{o.priority}</span>
                      </td>
                      <td>{o.loc}</td>
                      <td className="mono">{o.boxes}</td>
                      <td className="mono">{o.dur} min</td>
                      <td className="mono">
                        {o.route}
                        {o.route === 'R06' && scenario === 'normal' && (
                          <span style={{ color: 'var(--accent-amber)', marginLeft: '6px', fontSize: '10px' }}>
                            (peak only)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="detail-empty" style={{ padding: '16px', textAlign: 'center' }}>
                      No orders match “{searchTerm}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
