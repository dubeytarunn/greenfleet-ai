/**
 * GreenFlow AI - Central Frontend API Client
 * Centralizes all backend REST communication with the FastAPI server.
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Generic JSON request wrapper with error handling and timeout.
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  const config = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(url, config)

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string' 
            ? errorData.detail 
            : JSON.stringify(errorData.detail)
        }
      } catch {
        // Response wasn't JSON, use default error message
      }
      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error) {
    console.error(`[API Client] Request to ${endpoint} failed:`, error.message)
    throw error
  }
}

// --------------------------------------------------------------------------
// 1. Simulation & Benchmark Endpoints
// --------------------------------------------------------------------------

/**
 * Fetch the active simulation state (vehicles, routes, active assignments, benchmark).
 */
export async function getSimulationState() {
  return request('/api/simulate/state')
}

/**
 * Reset simulation state back to the deterministic normal baseline.
 */
export async function resetSimulation() {
  return request('/api/simulate/reset', { method: 'POST' })
}

/**
 * Trigger the peak demand surge simulation scenario.
 */
export async function simulatePeak() {
  return request('/api/simulate/peak', { method: 'POST' })
}

/**
 * Trigger the high traffic congestion simulation scenario.
 */
export async function simulateTraffic() {
  return request('/api/simulate/traffic', { method: 'POST' })
}

/**
 * Run GreenFlow Quantum-Inspired Optimization on the active scenario.
 */
export async function runOptimization() {
  return request('/api/simulate/optimize', { method: 'POST' })
}

/**
 * Fetch the latest dynamic Baseline vs GreenFlow benchmark comparison KPIs.
 */
export async function getBenchmark() {
  return request('/api/benchmark')
}

/**
 * Fetch active Carbon Budget Governor state.
 */
export async function getCarbonBudget() {
  return request('/api/simulate/carbon-budget')
}

/**
 * Reconfigure planning horizon carbon budget quota.
 */
export async function setCarbonBudget(budgetKg) {
  return request('/api/simulate/carbon-budget', {
    method: 'POST',
    body: JSON.stringify({ budget_kg: budgetKg }),
  })
}

// --------------------------------------------------------------------------
// 2. Fleet, Routes & Scoring Endpoints
// --------------------------------------------------------------------------

/**
 * Fetch all registered fleet vehicles.
 */
export async function getFleet(params = {}) {
  const query = new URLSearchParams()
  if (params.availableOnly !== undefined) query.append('available_only', params.availableOnly)
  if (params.vehicleType) query.append('vehicle_type', params.vehicleType)
  
  const queryString = query.toString() ? `?${query.toString()}` : ''
  return request(`/api/fleet/vehicles${queryString}`)
}

/**
 * Fetch all demand delivery routes.
 */
export async function getRoutes(params = {}) {
  const query = new URLSearchParams()
  if (params.minPriority !== undefined) query.append('min_priority', params.minPriority)
  
  const queryString = query.toString() ? `?${query.toString()}` : ''
  return request(`/api/fleet/routes${queryString}`)
}

/**
 * Compute explainable 5-factor suitability breakdown for vehicle-route pairs.
 */
export async function getScoring(vehicles, routes) {
  return request('/api/scoring', {
    method: 'POST',
    body: JSON.stringify({ vehicles, routes }),
  })
}

/**
 * Batch evaluate fuel consumption and CO2 emissions using the ML engine.
 */
export async function getPrediction(pairs) {
  return request('/api/predict/batch', {
    method: 'POST',
    body: JSON.stringify({ pairs }),
  })
}

/**
 * Compute custom fleet optimization assignment.
 */
export async function optimize(payload) {
  return request('/api/optimize/assign', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Fetch deterministic 5-factor explanation, best alternative, and counterfactual sensitivity for an assignment.
 */
export async function getAssignmentExplanation(vehicleId) {
  return request(`/api/assignments/${vehicleId}/explanation`)
}

// --------------------------------------------------------------------------
// 3. Commercial Decision Support & Economics Endpoints
// --------------------------------------------------------------------------

/**
 * Fetch differentiated economic savings statement (direct fuel savings & carbon shadow value in INR).
 */
export async function getEconomics() {
  return request('/api/simulate/economics')
}

/**
 * Update fuel price assumptions or internal carbon shadow price.
 */
export async function updateEconomics(payload) {
  return request('/api/simulate/economics', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Fetch dynamic dispatcher "What Should I Do?" actionable recommendation.
 */
export async function getRecommendation() {
  return request('/api/simulate/recommendation')
}

/**
 * Execute non-mutating 4-parameter what-if planning simulation.
 */
export async function simulateWhatIf(payload) {
  return request('/api/simulate/what-if', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Fetch 4-scenario comparative planning matrix (Normal, Peak, High Traffic, Carbon Constrained).
 */
export async function getScenarioMatrix() {
  return request('/api/simulate/scenarios')
}


export default {
  getSimulationState,
  resetSimulation,
  simulatePeak,
  simulateTraffic,
  runOptimization,
  getBenchmark,
  getCarbonBudget,
  setCarbonBudget,
  getAssignmentExplanation,
  getEconomics,
  updateEconomics,
  getRecommendation,
  simulateWhatIf,
  getScenarioMatrix,
  getFleet,
  getRoutes,
  getScoring,
  getPrediction,
  optimize,
}



