import React, { useState } from 'react'

export default function SettingsTab() {
  const [peakAlerts, setPeakAlerts] = useState(true)
  const [harshAlerts, setHarshAlerts] = useState(true)
  const [dailyEmail, setDailyEmail] = useState(false)

  return (
    <main className="tab-panel active">
      <div className="settings-grid">
        {/* Fleet Profile */}
        <section className="panel settings-card">
          <h2>Fleet Profile</h2>
          <div className="field-row">
            <label>Company name</label>
            <input defaultValue="GreenFlow Logistics Pvt. Ltd." readOnly />
          </div>
          <div className="field-row">
            <label>Depot location</label>
            <input defaultValue="Guindy Industrial Estate, Chennai" readOnly />
          </div>
          <div className="field-row">
            <label>Operating hours</label>
            <input defaultValue="08:00 – 18:00 IST" readOnly />
          </div>
          <div className="field-row">
            <label>Default vehicle capacity unit</label>
            <input defaultValue="Boxes" readOnly />
          </div>
        </section>

        {/* Notifications */}
        <section className="panel settings-card">
          <h2>Notifications &amp; Automated Alerts</h2>
          <div className="toggle-row">
            <div>
              <div className="toggle-row-text">Peak-demand surge alerts</div>
              <div className="toggle-row-sub">Notify operations coordinator when a route enters surge state</div>
            </div>
            <div
              className={`switch ${peakAlerts ? 'on' : ''}`}
              onClick={() => setPeakAlerts(!peakAlerts)}
            ></div>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-row-text">Harsh-driving telemetry alerts</div>
              <div className="toggle-row-sub">Notify manager when a driver efficiency score drops below 55</div>
            </div>
            <div
              className={`switch ${harshAlerts ? 'on' : ''}`}
              onClick={() => setHarshAlerts(!harshAlerts)}
            ></div>
          </div>

          <div className="toggle-row">
            <div>
              <div className="toggle-row-text">Daily plan dispatch summary</div>
              <div className="toggle-row-sub">Emailed to fleet manager after routes are planned each morning</div>
            </div>
            <div
              className={`switch ${dailyEmail ? 'on' : ''}`}
              onClick={() => setDailyEmail(!dailyEmail)}
            ></div>
          </div>
        </section>

        {/* Manager Users */}
        <section className="panel settings-card">
          <h2>Fleet Manager Accounts</h2>
          <div className="table-scroll" style={{ maxHeight: '220px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Access</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fleet Operations Lead</td>
                  <td>Owner</td>
                  <td>Full Access (All Modules)</td>
                </tr>
                <tr>
                  <td>Route Coordinator</td>
                  <td>Editor</td>
                  <td>Plan &amp; Live Tracking</td>
                </tr>
                <tr>
                  <td>Sustainability Analyst</td>
                  <td>Viewer</td>
                  <td>Analytics &amp; ESG Reports</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Optimization Defaults */}
        <section className="panel settings-card">
          <h2>
            Optimisation Defaults <span className="badge-soon">Advanced</span>
          </h2>
          <div className="field-row">
            <label>Active Solver Engine</label>
            <select defaultValue="sa">
              <option value="sa">Simulated Annealing (Quantum-Inspired QUBO)</option>
              <option value="milp">Classical MILP Baseline</option>
            </select>
          </div>
          <div className="field-row">
            <label>Fuel cost weight penalty</label>
            <input defaultValue="1.0" readOnly />
          </div>
          <div className="field-row">
            <label>CO₂ emission penalty factor</label>
            <input defaultValue="1.0" readOnly />
          </div>
        </section>
      </div>
    </main>
  )
}
