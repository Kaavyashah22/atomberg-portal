import { useState } from 'react'
import AdminDashboard from './components/AdminDashboard'
import EmployeeWorkspace from './components/EmployeeWorkspace'
import ManagerWorkspace from './components/ManagerWorkspace'

function App() {
  const [activeRole, setActiveRole] = useState('employee')

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-black tracking-tight leading-loose text-white">Atomberg Live Demo</h1>
          <div className="flex gap-2 sm:gap-4">
            <button 
              onClick={() => setActiveRole('employee')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${activeRole === 'employee' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
            >
              Employee View
            </button>
            <button 
              onClick={() => setActiveRole('manager')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${activeRole === 'manager' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
            >
              Manager View
            </button>
            <button 
              onClick={() => setActiveRole('admin')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${activeRole === 'admin' ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}`}
            >
              Admin View
            </button>
          </div>
        </div>
      </nav>
      
      <div className="pt-24 px-4 pb-12 max-w-7xl mx-auto">
        {activeRole === 'employee' && <EmployeeWorkspace />}
        {activeRole === 'manager' && <ManagerWorkspace />}
        {activeRole === 'admin' && <AdminDashboard />}
      </div>
    </div>
  )
}

export default App
