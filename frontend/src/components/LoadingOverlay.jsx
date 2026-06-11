import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, RefreshCw, WifiOff } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
const TIMEOUT_MS = 180_000; // 3 minutes

/* ── Rotating microcopy messages ──────────────── */
const LOADING_MESSAGES = [
  'Establishing Secure Database Connection...',
  'Synchronizing Enterprise Goal Structures...',
  'Initializing Performance Analytics Engine...',
  'Loading Organizational Hierarchy Data...',
  'Preparing Governance Compliance Modules...',
  'Hydrating Quarterly Tracking Pipelines...',
  'Warming Up Reporting Infrastructure...',
];

/* ── Context ──────────────────────────────────── */
const WarmupContext = createContext({ isWarmedUp: false });
// eslint-disable-next-line react-refresh/only-export-components
export const useWarmup = () => useContext(WarmupContext);

/* ── Indeterminate Progress Bar ───────────────── */
const IndeterminateBar = () => (
  <div className="w-64 h-1 rounded-full overflow-hidden bg-white/[0.06]">
    <motion.div
      className="h-full rounded-full bg-gradient-to-r from-atomberg-600 via-atomberg-400 to-atomberg-600"
      style={{ width: '40%' }}
      animate={{ x: ['-100%', '250%'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  </div>
);

/* ── Pulsing Logo ─────────────────────────────── */
const PulsingLogo = () => (
  <motion.div
    className="relative mb-8"
    animate={{ scale: [1, 1.05, 1] }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-atomberg-500 to-atomberg-700 flex items-center justify-center shadow-2xl shadow-atomberg-500/30">
      <Zap size={28} className="text-white" strokeWidth={2.5} />
    </div>
    <motion.div
      className="absolute -inset-3 rounded-2xl bg-gradient-to-br from-atomberg-500/20 to-transparent blur-xl -z-10"
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    />
  </motion.div>
);

/* ── Loading Overlay (full screen) ────────────── */
const LoadingScreen = ({ messageIdx, timedOut, onRetry }) => (
  <motion.div
    key="loading-overlay"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.4 }}
    className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
    style={{
      background: 'radial-gradient(ellipse at 60% 40%, rgba(255,107,0,0.04) 0%, #0f172a 70%)',
    }}
  >
    {/* Ambient orbs behind overlay */}
    <div className="absolute top-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full bg-atomberg-500/[0.03] blur-[100px] pointer-events-none" />
    <div className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-blue-500/[0.03] blur-[100px] pointer-events-none" />

    <div className="relative z-10 flex flex-col items-center text-center px-6">
      <PulsingLogo />

      <h1 className="text-xl font-extrabold text-white tracking-tight mb-1">
        Atomberg Performance Portal
      </h1>
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-atomberg-400/80 mb-8">
        Enterprise Edition
      </p>

      {!timedOut ? (
        <>
          <IndeterminateBar />
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIdx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-slate-400 mt-5 font-medium max-w-xs"
            >
              {LOADING_MESSAGES[messageIdx % LOADING_MESSAGES.length]}
            </motion.p>
          </AnimatePresence>
          <p className="text-[11px] text-slate-600 mt-3">
            Initial server warm-up may take up to 60 seconds
          </p>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
            <WifiOff size={22} className="text-rose-400" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Connection Timed Out</h2>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            The backend server is taking longer than expected to respond. Free-tier hosting may require a cold start — please retry.
          </p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-atomberg-600 to-atomberg-500 hover:from-atomberg-500 hover:to-atomberg-400 text-white shadow-lg shadow-atomberg-500/20 transition-all cursor-pointer"
          >
            <RefreshCw size={15} /> Retry Connection
          </button>
        </motion.div>
      )}
    </div>
  </motion.div>
);

/* ── Provider Component ───────────────────────── */
export const LoadingProvider = ({ children }) => {
  const [isWarmedUp, setIsWarmedUp] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [messageIdx, setMessageIdx] = useState(0);
  const [attemptKey, setAttemptKey] = useState(0);

  // Rotate loading messages every 3.5s
  useEffect(() => {
    if (isWarmedUp) return;
    const interval = setInterval(() => {
      setMessageIdx(prev => prev + 1);
    }, 3500);
    return () => clearInterval(interval);
  }, [isWarmedUp]);

  // Timeout after 3 minutes
  useEffect(() => {
    if (isWarmedUp) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isWarmedUp, attemptKey]);

  // Ping the backend health/primary endpoint
  const pingBackend = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/goals/sheet/active`, {
        headers: { 'Content-Type': 'application/json', 'X-User-ID': '14' },
      });
      if (res.ok) {
        setIsWarmedUp(true);
      }
    } catch {
      // Silently fail — will retry
    }
  }, []);

  useEffect(() => {
    if (isWarmedUp || timedOut) return;
    const t = setTimeout(() => { pingBackend(); }, 0);
    const interval = setInterval(pingBackend, 4000);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, [pingBackend, isWarmedUp, timedOut, attemptKey]);

  const handleRetry = () => {
    setTimedOut(false);
    setMessageIdx(0);
    setAttemptKey(prev => prev + 1);
  };

  return (
    <WarmupContext.Provider value={{ isWarmedUp }}>
      <AnimatePresence>
        {!isWarmedUp && (
          <LoadingScreen
            messageIdx={messageIdx}
            timedOut={timedOut}
            onRetry={handleRetry}
          />
        )}
      </AnimatePresence>
      {/* Render children always so they can mount, but hide behind overlay */}
      <div style={{ visibility: isWarmedUp ? 'visible' : 'hidden' }}>
        {children}
      </div>
    </WarmupContext.Provider>
  );
};

export default LoadingProvider;
