import React from 'react'
import Header from './components/common/Header.jsx'
import Dashboard from './components/dashboard/Dashboard.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950">
      <Header />
      <Dashboard />
    </div>
  )
}
