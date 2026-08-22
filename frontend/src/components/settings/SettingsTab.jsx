import React, { useState } from 'react'
import api from '../../services/api.js'

const VEHICLE_TYPES = ['Van', 'Truck', 'Mini Truck', 'Heavy Truck', 'Light Van (CNG)', 'Refrigerated Van']
const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Hybrid', 'Electric']

export default function SettingsTab({ carbonBudget, onShowToast, onVehicleRegistered }) {
  const [peakAlerts, setPeakAlerts] = useState(true)
  const [harshAlerts, setHarshAlerts] = useState(true)
  const [dailyEmail, setDailyEmail] = useState(false)

  const [budgetInput, setBudgetInput] = useState(carbonBudget?.budget_kg ?? 1500)
  const [hardCap, setHardCap] = useState(carbonBudget?.hard_cap_enabled ?? false)
  const [savingBudget, setSavingBudget] = useState(false)

  const [vehicleForm, setVehicleForm] = useState({
    vehicle_id: '', vehicle_type: 'Van', fuel_type: 'Diesel',
    vehicle_age: 1, fuel_capacity_l: 60, max_payload_kg: 1000, available: true,
  })
  const [registering, setRegistering] = useState(false)

  const updateField = (key, value) => setVehicleForm((f) => ({ ...f, [key]: value }))

  const handleSaveBudget = async () => {
    setSavingBudget(true)
    try {
      await api.setCarbonBudget(Number(budgetInput), hardCap)
      onShowToast && onShowToast(
        hardCap
          ? `Carbon budget set to ${budgetInput} kg — enforced as a hard limit`
          : `Carbon budget set to ${budgetInput} kg`
      )
      onVehicleRegistered && onVehicleRegistered() // reuse: just triggers a state refresh
    } catch (err) {
      onShowToast && onShowToast(`Could not update carbon budget: ${err.message}`)
    } finally {
      setSavingBudget(false)
    }
  }

  const handleRegisterVehicle = async (e) => {
    e.preventDefault()
    if (!vehicleForm.vehicle_id.trim()) {
      onShowToast && onShowToast('Vehicle ID is required')
      return
    }
    setRegistering(true)
    try {
      await api.registerVehicle({
        ...vehicleForm,
        vehicle_age: Number(vehicleForm.vehicle_age),
        fuel_capacity_l: Number(vehicleForm.fuel_capacity_l),
        max_payload_kg: Number(vehicleForm.max_payload_kg),
      })
      onShowToast && onShowToast(`Vehicle ${vehicleForm.vehicle_id} registered — now eligible for route assignment`)
      setVehicleForm((f) => ({ ...f, vehicle_id: '' }))
      onVehicleRegistered && onVehicleRegistered()
    } catch (err) {
      onShowToast && onShowToast(`Registration failed: ${err.message}`)
    } finally {
      setRegistering(false)
    }
  }

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

        {/* Carbon Budget Governor */}
        <section className="panel settings-card">
          <h2>Carbon Budget Governor</h2>
          <p className="insight-copy" style={{ marginBottom: '10px' }}>
            Sets the planning-horizon CO₂ quota. As utilisation rises, the optimizer's
            carbon penalty scales up automatically (HEALTHY → WARNING → CRITICAL → OVER_BUDGET).
          </p>
          <div className="field-row">
            <label>Budget (kg CO₂)</label>
            <input
              type="number"
              min="1"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </div>
          <div className="toggle-row">
            <div>
              <div className="toggle-row-text">Enforce as hard limit</div>
              <div className="toggle-row-sub">
                When on, the optimizer will not return a solution whose total CO₂
                exceeds budget — it will leave lower-priority routes unassigned instead.
                When off (default), the budget only reweights cost.
              </div>
            </div>
            <div
              className={`switch ${hardCap ? 'on' : ''}`}
              onClick={() => setHardCap(!hardCap)}
            ></div>
          </div>
          {carbonBudget && (
            <div className="detail-grid" style={{ marginTop: '10px' }}>
              <div className="detail-item">Status<b>{carbonBudget.status}</b></div>
              <div className="detail-item">Utilisation<b>{carbonBudget.budget_utilisation_pct}%</b></div>
              <div className="detail-item">Dynamic w_co2<b>{carbonBudget.dynamic_co2_penalty}</b></div>
              <div className="detail-item">Remaining<b>{carbonBudget.remaining_budget_kg} kg</b></div>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveBudget}
            disabled={savingBudget}
            style={{ marginTop: '12px' }}
          >
            <span className="btn-label">{savingBudget ? 'Saving…' : 'Apply Carbon Budget'}</span>
          </button>
        </section>

        {/* Vehicle Registration (fleet-manager action, not a driver portal) */}
        <section className="panel settings-card">
          <h2>Register Vehicle</h2>
          <p className="insight-copy" style={{ marginBottom: '10px' }}>
            Adds a vehicle to the fleet registry. Its type, fuel, age, and capacity
            feed directly into the fuel/CO₂ prediction used for route assignment.
          </p>
          <form onSubmit={handleRegisterVehicle}>
            <div className="field-row">
              <label>Vehicle ID</label>
              <input
                placeholder="e.g. V021"
                value={vehicleForm.vehicle_id}
                onChange={(e) => updateField('vehicle_id', e.target.value)}
              />
            </div>
            <div className="field-row">
              <label>Vehicle type</label>
              <select value={vehicleForm.vehicle_type} onChange={(e) => updateField('vehicle_type', e.target.value)}>
                {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field-row">
              <label>Fuel type</label>
              <select value={vehicleForm.fuel_type} onChange={(e) => updateField('fuel_type', e.target.value)}>
                {FUEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field-row">
              <label>Vehicle age (years)</label>
              <input type="number" min="0" value={vehicleForm.vehicle_age} onChange={(e) => updateField('vehicle_age', e.target.value)} />
            </div>
            <div className="field-row">
              <label>Fuel capacity (L)</label>
              <input type="number" min="1" value={vehicleForm.fuel_capacity_l} onChange={(e) => updateField('fuel_capacity_l', e.target.value)} />
            </div>
            <div className="field-row">
              <label>Max payload (kg)</label>
              <input type="number" min="1" value={vehicleForm.max_payload_kg} onChange={(e) => updateField('max_payload_kg', e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={registering}>
              <span className="btn-label">{registering ? 'Registering…' : 'Register Vehicle'}</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
