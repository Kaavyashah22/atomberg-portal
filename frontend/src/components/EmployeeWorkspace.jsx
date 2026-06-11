import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import {
  Plus, Save, AlertTriangle, Clock,
  Target, FileText, Send, Trash2, Info
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

/* ── SVG Progress Ring ──────────────────────────── */
const ProgressRing = ({ percent, size = 80, strokeWidth = 6 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const offset = circumference - (clampedPercent / 100) * circumference;
  const isComplete = clampedPercent === 100;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={isComplete ? '#10b981' : '#FF6B00'}
          strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="progress-ring-circle"
          style={{ filter: isComplete ? 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' : 'drop-shadow(0 0 6px rgba(255,107,0,0.3))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-extrabold ${isComplete ? 'text-emerald-400' : 'text-atomberg-400'}`}>
          {clampedPercent}%
        </span>
      </div>
    </div>
  );
};

/* ── Skeleton Screen ────────────────────────────── */
const SkeletonLoader = () => (
  <div className="space-y-6 pt-4">
    <div className="flex items-center justify-between">
      <div className="skeleton h-8 w-64" /><div className="skeleton h-8 w-24 rounded-full" />
    </div>
    <div className="glass-card p-1">
      <div className="skeleton h-14 w-full rounded-lg" />
      {[1,2,3].map(i => <div key={i} className="skeleton h-16 w-full rounded-lg mt-1" />)}
    </div>
  </div>
);

/* ── Tooltip Component ──────────────────────────── */
const Tooltip = ({ children, text }) => (
  <div className="relative group/tip inline-flex">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-xs text-slate-200 rounded-lg border border-white/10 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
    </div>
  </div>
);

/* ── Status Badge ───────────────────────────────── */
const StatusBadge = ({ status, locked }) => {
  const config = {
    Approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    Pending_Approval: { bg: 'bg-atomberg-500/10', text: 'text-atomberg-400', border: 'border-atomberg-500/20', pulse: true },
    Rework: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
    Draft: { bg: 'bg-slate-800', text: 'text-slate-400', border: 'border-slate-700' },
  };
  const c = config[status] || config.Draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text} ${c.border} ${c.pulse ? 'badge-pulse' : ''}`}>
      {c.pulse && <span className="w-1.5 h-1.5 rounded-full bg-atomberg-400 animate-pulse" />}
      {status.replace('_', ' ')}{locked ? ' · Locked' : ''}
    </span>
  );
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } } };

/* ── Helpers ────────────────────────────────────── */
const QUARTER_WINDOWS = {
  Q1: { month: 'July', period: 'Jul–Sep' },
  Q2: { month: 'October', period: 'Oct–Dec' },
  Q3: { month: 'January', period: 'Jan–Mar' },
  Q4: { month: 'March', period: 'Mar (Year-End)' },
};

const EmployeeWorkspace = () => {
  const [xUserId, setXUserId] = useState(14);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [goals, setGoals] = useState([]);
  const [validationError, setValidationError] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [trackingState, setTrackingState] = useState({});

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-User-ID': xUserId.toString(), ...options.headers }
    });
    if (!res.ok) { const err = await res.json().catch(() => null); throw new Error(err?.detail || `Request failed: ${res.status}`); }
    return res.json();
  }, [xUserId]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`${API_BASE_URL}/api/v1/goals/sheet/active`);
      setSheet(data.sheet); setCycleStatus(data.cycle_status); setGoals(data.goals || []);
      const initTracking = {};
      if (data.tracking) { data.tracking.forEach(t => {
        if (!initTracking[t.goal_id]) initTracking[t.goal_id] = {};
        initTracking[t.goal_id][t.quarter] = {
          ...t,
          actual_achievement: t.actual_achievement != null ? parseFloat(Number(t.actual_achievement).toFixed(2)) : null,
        };
      }); }
      setTrackingState(initTracking);
    } catch {
      setSheet({ id: 101, status: 'Draft', is_locked: false, cycle_year: 2026 });
      setGoals([{ id: Date.now(), thrust_area: 'Operational Excellence', title: 'Reduce Latency', description: 'Optimize queries', uom: 'Numeric_Min', target_value: 50, weightage: 100, deadline: '', is_shared: false }]);
    } finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => { 
    const t = setTimeout(() => { loadWorkspace(); }, 0);
    return () => clearTimeout(t);
  }, [loadWorkspace]);

  const totalWeightage = goals.reduce((acc, g) => acc + (Number(g.weightage) || 0), 0);
  const isMaxGoalsReached = goals.length >= 8;
  const isReadOnly = sheet && (sheet.status === 'Pending_Approval' || sheet.status === 'Approved');
  const isTrackingMode = sheet && sheet.status === 'Approved' && sheet.is_locked;

  const handleAddGoal = () => { if (isMaxGoalsReached) return; setGoals([...goals, { id: Date.now(), thrust_area: '', title: '', description: '', uom: 'Numeric_Max', target_value: 0, weightage: 0, deadline: '', is_shared: false }]); };
  const handleGoalChange = (index, field, value) => { const n = [...goals]; n[index][field] = value; setGoals(n); };
  const handleDeleteGoal = (index) => { setGoals(goals.filter((_, i) => i !== index)); };

  const handleSubmitSheet = async () => {
    if (goals.length === 0) { setValidationError("A goal sheet cannot be submitted empty."); return; }
    if (totalWeightage !== 100) { setValidationError(`Total weightage must equal exactly 100%. Current total is ${totalWeightage}%.`); return; }
    const invalidGoal = goals.find(g => Number(g.weightage) < 10);
    if (invalidGoal) { setValidationError(`Minimum weightage per individual goal must be >= 10%.`); return; }
    setValidationError('');
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/goals/submit`, {
        method: 'POST',
        body: JSON.stringify({ sheet_id: sheet.id, goals: goals.map(g => ({ id: g.id > 1000000 ? null : g.id, thrust_area: g.thrust_area, title: g.title, description: g.description, uom: g.uom, target_value: Number(g.target_value), weightage: Number(g.weightage), deadline: g.deadline || null })) })
      });
      toast.success('Goal sheet submitted successfully!');
      setSheet(prev => ({ ...prev, status: 'Pending_Approval' }));
    } catch (err) { setValidationError(err.message); }
  };

  const handleTrackingChange = (goalId, field, value) => {
    setTrackingState(prev => ({ ...prev, [goalId]: { ...(prev[goalId] || {}), [selectedQuarter]: { ...(prev[goalId]?.[selectedQuarter] || {}), [field]: value } } }));
  };

  const handleSaveTracking = async (goalId) => {
    const data = trackingState[goalId]?.[selectedQuarter] || {};
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/tracking/employee/update`, {
        method: 'PUT',
        body: JSON.stringify({ goal_id: goalId, quarter: selectedQuarter, actual_achievement: data.actual_achievement ? Number(data.actual_achievement) : null, status: data.status || 'Not Started', completion_date: data.completion_date || null })
      });
      toast.success('Quarterly update saved.');
    } catch (err) { toast.error(`Sync Error: ${err.message}`); }
  };

  /* ── Goal Setting Matrix ────────────────────── */
  const renderGoalSettingMatrix = () => (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* Weightage + Progress Ring Banner */}
      <motion.div variants={fadeUp}
        className={`glass-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 ${totalWeightage === 100 ? 'border-emerald-500/20' : 'border-atomberg-500/20'}`}
      >
        <div className="flex items-center gap-5">
          <ProgressRing percent={totalWeightage} />
          <div>
            <h3 className={`font-bold text-sm ${totalWeightage === 100 ? 'text-emerald-400' : 'text-atomberg-300'}`}>
              {totalWeightage === 100 ? 'Weightage Balanced' : 'Weightage Allocation'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{goals.length}/8 Goals · {Number(totalWeightage).toFixed(2)}% of 100% allocated</p>
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap justify-end">
          {!isReadOnly && (
            <Tooltip text={isMaxGoalsReached ? 'Maximum 8 goals reached' : (cycleStatus && !cycleStatus.can_edit_goals) ? 'Goal editing window closed (May)' : 'Add a new goal row'}>
              <button onClick={handleAddGoal}
                disabled={isMaxGoalsReached || (cycleStatus && !cycleStatus.can_edit_goals)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12] text-slate-200 cursor-pointer"
              ><Plus size={15} /> Add Goal</button>
            </Tooltip>
          )}
          <Tooltip text={isReadOnly ? 'Sheet already submitted' : (cycleStatus && !cycleStatus.can_edit_goals) ? 'Submission window: May only' : 'Submit sheet for manager approval'}>
            <button onClick={handleSubmitSheet}
              disabled={isReadOnly || (cycleStatus && !cycleStatus.can_edit_goals)}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                (isReadOnly || (cycleStatus && !cycleStatus.can_edit_goals))
                  ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-gradient-to-r from-atomberg-600 to-atomberg-500 hover:from-atomberg-500 hover:to-atomberg-400 text-white shadow-lg shadow-atomberg-500/20'
              }`}
            ><Send size={15} /> {isReadOnly ? 'Submitted' : 'Submit for Approval'}</button>
          </Tooltip>
        </div>
      </motion.div>

      {validationError && (
        <motion.div variants={fadeUp} className="glass-card border-rose-500/20 p-4 flex items-center gap-3">
          <AlertTriangle className="text-rose-400 flex-shrink-0" size={18} />
          <span className="text-sm font-medium text-rose-300">{validationError}</span>
        </motion.div>
      )}
      {cycleStatus && cycleStatus.phase === "CLOSED" && (
        <motion.div variants={fadeUp} className="glass-card border-amber-500/20 p-4 flex items-center gap-3">
          <Clock className="text-amber-400 flex-shrink-0" size={18} />
          <span className="text-sm font-medium text-amber-300">Action windows are currently closed. Next tracking window opens in July/Oct/Jan/Mar.</span>
        </motion.div>
      )}

      {/* Goal Table */}
      <motion.div variants={fadeUp} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-4 py-3.5 min-w-[140px]">Thrust Area</th>
                <th className="px-4 py-3.5 min-w-[180px]">Goal Title</th>
                <th className="px-4 py-3.5">UoM</th>
                <th className="px-4 py-3.5 w-24">Target</th>
                <th className="px-4 py-3.5 w-24">Weight %</th>
                <th className="px-4 py-3.5 w-36">Deadline</th>
                <th className="px-4 py-3.5 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {goals.map((g, idx) => (
                <motion.tr key={g.id} variants={fadeUp} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">{isReadOnly && !g.thrust_area ? <span className="text-sm italic text-slate-500">General</span> : <input type="text" value={g.thrust_area} onChange={(e) => handleGoalChange(idx, 'thrust_area', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm" placeholder="e.g. Revenue" />}</td>
                  <td className="px-4 py-3"><input type="text" value={g.title} onChange={(e) => handleGoalChange(idx, 'title', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm" placeholder="Goal title" /></td>
                  <td className="px-4 py-3">
                    <select value={g.uom} onChange={(e) => handleGoalChange(idx, 'uom', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm">
                      <option value="Numeric_Max">Numeric Max</option><option value="Numeric_Min">Numeric Min</option><option value="Timeline">Timeline</option><option value="Zero_Based">Zero Based</option>
                    </select>
                  </td>
                  <td className="px-4 py-3"><input type="number" value={g.target_value} onChange={(e) => handleGoalChange(idx, 'target_value', e.target.value)} disabled={g.is_shared || g.uom === 'Zero_Based' || isReadOnly} className="w-full text-sm" /></td>
                  <td className="px-4 py-3"><input type="number" value={g.weightage} onChange={(e) => handleGoalChange(idx, 'weightage', e.target.value)} disabled={isReadOnly} className="w-full text-sm font-mono" /></td>
                  <td className="px-4 py-3"><input type="date" value={g.deadline} onChange={(e) => handleGoalChange(idx, 'deadline', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm" /></td>
                  <td className="px-4 py-3 text-center">
                    {!g.is_shared && !isReadOnly && (
                      <button onClick={() => handleDeleteGoal(idx)} className="text-slate-600 hover:text-rose-400 transition-colors p-1 opacity-0 group-hover:opacity-100 cursor-pointer"><Trash2 size={16} /></button>
                    )}
                  </td>
                </motion.tr>
              ))}
              {goals.length === 0 && (
                <tr><td colSpan="7" className="px-6 py-16 text-center">
                  <FileText size={40} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-sm font-semibold text-slate-400">No goals added yet</p>
                  <p className="text-xs text-slate-600 mt-1">Click "Add Goal" to begin building your goal sheet.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );

  /* ── Tracking Logger ────────────────────────── */
  const renderTrackingLogger = () => (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Target size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Quarterly Tracking Logger</h2>
            <p className="text-xs text-slate-400">Log actual achievements against your approved targets.</p>
          </div>
        </div>
        <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
          className="bg-gradient-to-r from-atomberg-600 to-atomberg-500 border-none rounded-lg py-2 px-4 text-sm font-bold text-white cursor-pointer shadow-lg shadow-atomberg-500/20"
        >
          <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>
        </select>
      </motion.div>

      {cycleStatus && cycleStatus.phase === "GOAL_SETTING" && (
        <motion.div variants={fadeUp} className="glass-card border-amber-500/20 p-4 flex items-center gap-3">
          <Clock className="text-amber-400 flex-shrink-0" size={18} />
          <span className="text-sm font-medium text-amber-300">Tracking updates are currently closed. The {selectedQuarter} tracking window opens in {QUARTER_WINDOWS[selectedQuarter]?.month || 'the next cycle month'} ({QUARTER_WINDOWS[selectedQuarter]?.period}).</span>
        </motion.div>
      )}

      {goals.map((g) => {
        const tState = trackingState[g.id]?.[selectedQuarter] || {};
        const isZeroBased = g.uom === 'Zero_Based';
        const isLogLocked = cycleStatus && !cycleStatus.can_update_tracking;
        return (
          <motion.div key={g.id} variants={fadeUp} className="glass-card glass-card-hover overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-atomberg-500" />
                <span className="font-semibold text-white text-sm">{g.title}</span>
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider bg-slate-800/50 px-2 py-0.5 rounded-full">{Number(g.weightage).toFixed(2)}% weight</span>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
              {!isZeroBased ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Actual Achievement</label>
                  <input type="number" step="0.01" value={tState.actual_achievement ?? ''}
                    onChange={(e) => handleTrackingChange(g.id, 'actual_achievement', e.target.value)}
                    onBlur={(e) => { if (e.target.value !== '') handleTrackingChange(g.id, 'actual_achievement', parseFloat(Number(e.target.value).toFixed(2))); }}
                    disabled={isLogLocked} className="w-full text-sm" />
                </div>
              ) : (
                <div className="text-slate-500 italic text-sm flex items-center gap-2"><Info size={14} /> Zero Based Goal</div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Progress Status</label>
                <select value={tState.status || 'Not Started'} onChange={(e) => handleTrackingChange(g.id, 'status', e.target.value)} disabled={isLogLocked} className="w-full text-sm">
                  <option value="Not Started">Not Started</option><option value="On Track">On Track</option><option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Completion Date</label>
                <input type="date" value={tState.completion_date || ''} onChange={(e) => handleTrackingChange(g.id, 'completion_date', e.target.value)} disabled={isLogLocked} className="w-full text-sm" />
              </div>
              <div>
                <Tooltip text={isLogLocked ? 'Tracking window closed. Opens Jul/Oct/Jan/Mar.' : 'Save this quarter\'s tracking data'}>
                  <button onClick={() => handleSaveTracking(g.id)} disabled={isLogLocked}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isLogLocked ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    }`}
                  ><Save size={15} /> {isLogLocked ? 'Closed' : 'Save'}</button>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );

  if (loading) return <SkeletonLoader />;

  return (
    <div className="text-slate-200 font-sans pb-6">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3 h-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-atomberg-600 to-atomberg-500 flex items-center justify-center shadow-lg shadow-atomberg-500/20">
            <Target size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Employee Workspace</h1>
            <p className="text-xs text-slate-500 font-medium">Goal Setting & Performance Tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-3 h-10">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden sm:block">Context</label>
            <select value={xUserId} onChange={(e) => setXUserId(Number(e.target.value))}
              className="bg-transparent border-none py-0.5 pl-1 pr-6 text-sm font-semibold text-white focus:ring-0 cursor-pointer"
            >
              <option value={14}>Employee (ID: 14)</option>
              <option value={15}>Employee (ID: 15)</option>
            </select>
          </div>
        </div>
      </motion.header>

      {/* Sheet Status */}
      {sheet && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-extrabold text-white">My Goal Sheet</h2>
          <span className="text-sm font-mono text-slate-500">{sheet.cycle_year} Cycle</span>
          <StatusBadge status={sheet.status} locked={sheet.is_locked} />
        </motion.div>
      )}

      {/* Content */}
      {!sheet ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-16 text-center">
          <FileText size={48} className="mx-auto text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-300">No Active Goal Sheet</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">You do not currently have a goal sheet assigned for this cycle. Contact your manager or HR admin.</p>
        </motion.div>
      ) : (
        isTrackingMode ? renderTrackingLogger() : renderGoalSettingMatrix()
      )}
    </div>
  );
};

export default EmployeeWorkspace;
