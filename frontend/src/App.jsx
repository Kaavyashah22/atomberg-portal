import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Toaster } from 'react-hot-toast'
import { Zap, User, Users, ShieldCheck } from 'lucide-react'
import AdminDashboard from './components/AdminDashboard'
import EmployeeWorkspace from './components/EmployeeWorkspace'
import ManagerWorkspace from './components/ManagerWorkspace'

const roles = [
  { key: 'employee', label: 'Employee', icon: User },
  { key: 'manager', label: 'Manager', icon: Users },
  { key: 'admin', label: 'Admin', icon: ShieldCheck },
]

function App() {
  const [activeRole, setActiveRole] = useState('employee')

  return (
    <div className="min-h-screen bg-deep relative overflow-x-hidden">
      {/* Ambient Background Orbs */}
      <div className="bg-orb bg-orb-orange" aria-hidden="true" />
      <div className="bg-orb bg-orb-blue" aria-hidden="true" />

      {/* Global Toast Provider */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(16px)',
            padding: '14px 20px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
          },
        }}
      />

      {/* ══════ Premium Glassmorphic Header ══════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-atomberg-500 to-atomberg-700 flex items-center justify-center shadow-lg shadow-atomberg-500/20">
                <Zap size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-atomberg-500/20 to-transparent blur-sm -z-10" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                Atomberg
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-atomberg-400 leading-none mt-0.5">
                Performance Portal
              </p>
            </div>
          </div>

          {/* ══════ Persona Switcher ══════ */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {roles.map((role) => {
              const Icon = role.icon
              const isActive = activeRole === role.key
              return (
                <button
                  key={role.key}
                  onClick={() => setActiveRole(role.key)}
                  className={`relative px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors duration-200 cursor-pointer ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeRoleIndicator"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-atomberg-600 to-atomberg-500 shadow-lg shadow-atomberg-500/25"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="hidden xs:inline sm:inline">{role.label}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* ══════ Main Content Area ══════ */}
      <div className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {activeRole === 'employee' && <EmployeeWorkspace />}
            {activeRole === 'manager' && <ManagerWorkspace />}
            {activeRole === 'admin' && <AdminDashboard />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ══════ Footer ══════ */}
      <footer className="relative z-10 border-t border-white/[0.04] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-xs text-slate-600 font-medium">
            © 2026 Atomberg Technologies · Performance Portal v2.0
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">System Operational</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
