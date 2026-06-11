import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import {
  Users, CheckCircle, FileText, AlertTriangle, ChevronRight,
  MessageSquare, Save, UserCheck, ShieldCheck, ArrowLeft,
  Activity, Clock
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } } };
const fmt = (v) => v != null && v !== '' ? Number(v).toFixed(2) : '—';

/* ── Tooltip ────────────────────────────────────── */
const Tooltip = ({ children, text }) => (
  <div className="relative group/tip inline-flex">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-xs text-slate-200 rounded-lg border border-white/10 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
    </div>
  </div>
);

/* ── Skeleton ───────────────────────────────────── */
const SkeletonLoader = () => (
  <div className="space-y-6 pt-4">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
    </div>
    <div className="skeleton h-64 rounded-xl" />
  </div>
);

/* ── KPI Card ───────────────────────────────────── */
const KPICard = ({ title, value, icon: Icon, color }) => {
  const gradients = {
    blue: 'from-blue-600 to-blue-700 shadow-blue-500/20',
    orange: 'from-atomberg-600 to-atomberg-700 shadow-atomberg-500/20',
    emerald: 'from-emerald-600 to-emerald-700 shadow-emerald-500/20',
  };
  return (
    <motion.div variants={fadeUp} className="glass-card glass-card-hover p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-white mt-1.5 font-mono">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-lg`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </motion.div>
  );
};

/* ── Status Badge ───────────────────────────────── */
const StatusBadge = ({ status }) => {
  const c = {
    Pending_Approval: { cls: 'bg-atomberg-500/10 text-atomberg-400 border-atomberg-500/20', pulse: true },
    Approved: { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    Draft: { cls: 'bg-slate-800 text-slate-400 border-slate-700' },
    Rework: { cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  }[status] || { cls: 'bg-slate-800 text-slate-400 border-slate-700' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.cls} ${c.pulse ? 'badge-pulse' : ''}`}>
      {c.pulse && <span className="w-1.5 h-1.5 rounded-full bg-atomberg-400 animate-pulse" />}
      {status.replace('_', ' ')}
    </span>
  );
};

const ManagerWorkspace = () => {
  const [xUserId, setXUserId] = useState(4);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSheet, setEmployeeSheet] = useState(null);
  const [employeeGoals, setEmployeeGoals] = useState([]);
  const [employeeTracking, setEmployeeTracking] = useState([]);
  const [goalEdits, setGoalEdits] = useState({});
  const [managerComments, setManagerComments] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [cycleStatus, setCycleStatus] = useState(null);

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'X-User-ID': String(xUserId), ...options.headers } });
    if (!res.ok) { const err = await res.json().catch(() => null); throw new Error(err?.detail || `Request failed: ${res.status}`); }
    return res.json();
  }, [xUserId]);

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await fetchWithAuth(`${API_BASE_URL}/api/v1/manager/team`); setTeamMembers(data || []); }
    catch (err) { setError("Failed to load team data: " + err.message); }
    finally { setLoading(false); }
  }, [fetchWithAuth]);

  useEffect(() => {
    // delay the synchronous state update to avoid cascading renders warning
    const t = setTimeout(() => { loadDashboard(); }, 0);
    return () => clearTimeout(t);
  }, [loadDashboard]);

  const handleSelectEmployee = async (emp) => {
    if (emp.status === 'Draft' || emp.status === 'Rework') { toast('This sheet is currently with the employee.', { icon: '📝' }); return; }
    setLoading(true); setSelectedEmployee(emp);
    try {
      const data = await fetchWithAuth(`${API_BASE_URL}/api/v1/manager/employee/${emp.id}/tracking`);
      setEmployeeSheet(data.sheet); setEmployeeGoals(data.goals); setEmployeeTracking(data.tracking); setCycleStatus(data.cycle_status); setGoalEdits({}); setManagerComments({});
    } catch (err) { toast.error("Failed to load employee details: " + err.message); setSelectedEmployee(null); }
    finally { setLoading(false); }
  };

  const handleEditChange = (goalId, field, value) => { setGoalEdits(prev => ({ ...prev, [goalId]: { ...(prev[goalId] || {}), [field]: value } })); };

  const handleReviewAction = async (actionStatus) => {
    try {
      const editsArray = Object.entries(goalEdits).map(([gId, edit]) => ({ goal_id: Number(gId), ...(edit.target_value && { target_value: Number(edit.target_value) }), ...(edit.weightage && { weightage: Number(edit.weightage) }) }));
      await fetchWithAuth(`${API_BASE_URL}/api/v1/manager/review/${employeeSheet.id}`, { method: 'POST', body: JSON.stringify({ status: actionStatus, goal_edits: editsArray.length > 0 ? editsArray : null }) });
      toast.success(`Sheet ${actionStatus === 'Approved' ? 'approved & locked' : 'returned for rework'}!`);
      setSelectedEmployee(null); loadDashboard();
    } catch (err) { toast.error(`Review Error: ${err.message}`); }
  };

  const handleCheckinSubmit = async (goalId) => {
    const comment = managerComments[goalId];
    if (!comment || comment.trim() === '') { toast.error("Feedback comment is mandatory."); return; }
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/tracking/manager/checkin`, { method: 'POST', body: JSON.stringify({ goal_id: goalId, quarter: selectedQuarter, manager_comment: comment }) });
      toast.success(`Check-in logged for goal.`);
    } catch (err) { toast.error(`Check-in Error: ${err.message}`); }
  };

  /* ── Dashboard View ─────────────────────────── */
  const renderDashboard = () => {
    const awaitingReviewCount = teamMembers.filter(m => m.status === 'Pending_Approval').length;
    const approvedCount = teamMembers.filter(m => m.status === 'Approved').length;
    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard title="Total Direct Reports" value={teamMembers.length} icon={Users} color="blue" />
          <KPICard title="Awaiting Review" value={awaitingReviewCount} icon={FileText} color="orange" />
          <KPICard title="Approved & Locked" value={approvedCount} icon={ShieldCheck} color="emerald" />
        </motion.div>

        <motion.div variants={fadeUp} className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck size={16} className="text-atomberg-400" /> Team Members
            </h3>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{teamMembers.length} members</span>
          </div>
          <motion.div variants={stagger} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-4 gap-4">
            {teamMembers.map((member) => (
              <motion.div key={member.id} variants={fadeUp}
                onClick={() => handleSelectEmployee(member)}
                className={`glass-card p-5 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 ${
                  member.status === 'Pending_Approval' ? '!border-atomberg-500/25 hover:!border-atomberg-500/40' :
                  member.status === 'Approved' ? '!border-emerald-500/15' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-white text-sm">{member.name}</h4>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{member.department}</p>
                  </div>
                  <ChevronRight className="text-slate-600" size={16} />
                </div>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                  <StatusBadge status={member.status} />
                  {member.status === 'Pending_Approval' && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-atomberg-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-atomberg-500" />
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
            {teamMembers.length === 0 && (
              <div className="col-span-full py-16 text-center">
                <Users size={40} className="mx-auto text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-400">No Direct Reports</p>
                <p className="text-xs text-slate-600 mt-1">You currently have no employees assigned.</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    );
  };

  /* ── Review Panel ───────────────────────────── */
  const renderReviewPanel = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <button onClick={() => setSelectedEmployee(null)} className="flex items-center text-sm font-semibold text-slate-400 hover:text-atomberg-400 transition-colors cursor-pointer">
        <ArrowLeft size={15} className="mr-1.5" /> Back to Dashboard
      </button>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText size={16} className="text-atomberg-400" /> Review: {selectedEmployee.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Review proposed goals for Cycle 2026</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleReviewAction('Rework')}
              className="bg-transparent border border-rose-500/25 hover:bg-rose-500/10 text-rose-400 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
            ><AlertTriangle size={14} /> Rework</button>
            <button onClick={() => handleReviewAction('Approved')}
              className="bg-gradient-to-r from-atomberg-600 to-atomberg-500 hover:from-atomberg-500 hover:to-atomberg-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-atomberg-500/20 cursor-pointer"
            ><CheckCircle size={14} /> Approve & Lock</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                <th className="px-4 py-3.5">Thrust Area</th>
                <th className="px-4 py-3.5 min-w-[200px]">Goal Title</th>
                <th className="px-4 py-3.5">UoM</th>
                <th className="px-4 py-3.5 w-28">Target Override</th>
                <th className="px-4 py-3.5 w-28">Weight Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-sm">
              {employeeGoals.map((g) => (
                <tr key={g.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5 font-semibold text-slate-300">{g.thrust_area || <span className="italic text-slate-500">General</span>}</td>
                  <td className="px-4 py-3.5 font-medium text-white">{g.title}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-white/[0.04] px-2 py-0.5 rounded-md">{g.uom.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" placeholder={g.target_value.toString()} value={goalEdits[g.id]?.target_value || ''}
                      onChange={(e) => handleEditChange(g.id, 'target_value', e.target.value)} disabled={g.is_shared}
                      className={`w-full text-sm ${g.is_shared ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" placeholder={`${Number(g.weightage).toFixed(2)}%`} value={goalEdits[g.id]?.weightage || ''}
                      onChange={(e) => handleEditChange(g.id, 'weightage', e.target.value)}
                      className="w-full text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  /* ── Checkin Panel ──────────────────────────── */
  const renderCheckinPanel = () => (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <button onClick={() => setSelectedEmployee(null)} className="flex items-center text-sm font-semibold text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer">
        <ArrowLeft size={15} className="mr-1.5" /> Back to Dashboard
      </button>

      <div className="glass-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Performance Check-in: {selectedEmployee.name}</h2>
            <p className="text-xs text-slate-500">Review locked goals and log manager feedback.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Quarter</label>
          <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}
            className="bg-gradient-to-r from-emerald-600 to-emerald-500 border-none rounded-md py-1.5 px-3 text-sm font-bold text-white cursor-pointer"
          >
            <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>
          </select>
        </div>
      </div>

      {cycleStatus && !cycleStatus.can_update_tracking && (
        <div className="glass-card border-amber-500/20 p-4 flex items-center gap-3">
          <Clock className="text-amber-400 flex-shrink-0" size={18} />
          <span className="text-sm font-medium text-amber-300">Manager check-ins currently closed. Opens next cycle month (Jul/Oct/Jan/Mar).</span>
        </div>
      )}

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        {employeeGoals.map((g) => {
          const trackData = employeeTracking.find(t => t.goal_id === g.id && t.quarter === selectedQuarter) || {};
          const progressPercent = g.target_value > 0 && trackData.actual_achievement != null
            ? Math.min(Math.round((trackData.actual_achievement / g.target_value) * 100), 100) : 0;

          return (
            <motion.div key={g.id} variants={fadeUp} className="glass-card glass-card-hover overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06] flex flex-col sm:flex-row justify-between gap-3">
                <div>
                  <h3 className="font-bold text-white text-sm">{g.title}</h3>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{g.thrust_area || <span className="italic">General</span>} · {Number(g.weightage).toFixed(2)}% weight</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Target</p>
                    <p className="font-extrabold text-white text-sm font-mono">{g.uom === 'Zero_Based' ? '0.00' : fmt(g.target_value)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-semibold text-emerald-500 uppercase">Actual</p>
                    <p className="font-extrabold text-emerald-400 text-sm font-mono">{trackData.actual_achievement != null ? fmt(trackData.actual_achievement) : '—'}</p>
                  </div>
                  {g.target_value > 0 && (
                    <div className="w-20">
                      <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${progressPercent >= 80 ? 'bg-emerald-500' : progressPercent >= 50 ? 'bg-atomberg-500' : 'bg-amber-500'}`}
                          style={{ width: `${progressPercent}%` }} />
                      </div>
                      <p className="text-[9px] text-slate-500 text-center mt-0.5 font-mono">{progressPercent}%</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 flex flex-col md:flex-row gap-5">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Manager Feedback
                  </label>
                  <textarea rows="3" placeholder="Enter performance feedback for this quarter..."
                    value={managerComments[g.id] || trackData.manager_comment || ''}
                    onChange={(e) => setManagerComments({ ...managerComments, [g.id]: e.target.value })}
                    className="w-full text-sm resize-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <Tooltip text={cycleStatus && !cycleStatus.can_update_tracking ? 'Check-in window closed' : 'Submit your check-in feedback'}>
                    <button onClick={() => handleCheckinSubmit(g.id)}
                      disabled={cycleStatus && !cycleStatus.can_update_tracking}
                      className={`px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                        cycleStatus && !cycleStatus.can_update_tracking
                          ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                      }`}
                    ><Save size={15} /> {cycleStatus && !cycleStatus.can_update_tracking ? 'Closed' : 'Submit'}</button>
                  </Tooltip>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );

  return (
    <div className="text-slate-200 font-sans pb-6">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3 h-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight">Manager Workspace</h1>
            <p className="text-xs text-slate-500 font-medium">Team Goal Review & Quarterly Check-ins</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hidden sm:block">Persona</label>
          <select value={xUserId} onChange={(e) => { setXUserId(Number(e.target.value)); setSelectedEmployee(null); }}
            className="bg-transparent border-none py-0.5 pl-1 pr-6 text-sm font-semibold text-white focus:ring-0 cursor-pointer"
          >
            <option value={4}>L1 Manager (ID: 4)</option>
            <option value={5}>L1 Manager (ID: 5)</option>
          </select>
        </div>
      </motion.header>

      {error && (
        <div className="mb-6 glass-card border-rose-500/20 p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-rose-400" />
          <p className="text-sm font-medium text-rose-300">{error}</p>
        </div>
      )}

      {loading && !selectedEmployee ? <SkeletonLoader /> :
        !selectedEmployee ? renderDashboard() :
        selectedEmployee.status === 'Pending_Approval' ? renderReviewPanel() :
        renderCheckinPanel()}
    </div>
  );
};

export default ManagerWorkspace;
