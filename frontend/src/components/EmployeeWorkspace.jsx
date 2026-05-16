import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Save, AlertTriangle, CheckCircle, Clock, 
  Target, ShieldAlert, FileText, Send, Trash2, Calendar
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const EmployeeWorkspace = () => {
  const [xUserId, setXUserId] = useState(14); // Default to Mock Employee
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  
  // Workspace State
  const [sheet, setSheet] = useState(null);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [goals, setGoals] = useState([]);
  
  // View A specific state
  const [validationError, setValidationError] = useState('');
  
  // View B specific state
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');
  const [trackingState, setTrackingState] = useState({});

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': xUserId.toString(),
        ...options.headers,
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `Request failed: ${res.status}`);
    }
    return res.json();
  };

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // This hits the assumed endpoint for fetching the employee's active sheet
      const data = await fetchWithAuth(`${API_BASE_URL}/api/v1/goals/sheet/active`);
      setSheet(data.sheet);
      setCycleStatus(data.cycle_status);
      setGoals(data.goals || []);
      
      // Pre-fill tracking state from fetched data if available
      const initTracking = {};
      if (data.tracking) {
        data.tracking.forEach(t => {
          if (!initTracking[t.goal_id]) initTracking[t.goal_id] = {};
          initTracking[t.goal_id][t.quarter] = t;
        });
      }
      setTrackingState(initTracking);
    } catch (err) {
      console.warn("Backend endpoint /api/v1/goals/my-sheet missing or failing. Simulating hydration...");
      // Simulate fallback state so the UI remains interactive for the demo
      setSheet({ id: 101, status: 'Draft', is_locked: false, cycle_year: 2026 });
      setGoals([{ 
        id: Date.now(), thrust_area: 'Operational Excellence', title: 'Reduce Latency', 
        description: 'Optimize queries', uom: 'Numeric_Min', target_value: 50, weightage: 100, deadline: '', is_shared: false 
      }]);
    } finally {
      setLoading(false);
    }
  }, [xUserId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  // ==========================================
  // VIEW A: Interactive Goal Setting Matrix
  // ==========================================
  const totalWeightage = goals.reduce((acc, g) => acc + (Number(g.weightage) || 0), 0);
  const isMaxGoalsReached = goals.length >= 8;

  const handleAddGoal = () => {
    if (isMaxGoalsReached) return;
    setGoals([...goals, { 
      id: Date.now(), thrust_area: '', title: '', description: '', 
      uom: 'Numeric_Max', target_value: 0, weightage: 0, deadline: '', is_shared: false 
    }]);
  };

  const handleGoalChange = (index, field, value) => {
    const newGoals = [...goals];
    newGoals[index][field] = value;
    setGoals(newGoals);
  };

  const handleDeleteGoal = (index) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleSubmitSheet = async () => {
    // Client-side Defensive Validations
    if (goals.length === 0) {
      setValidationError("A goal sheet cannot be submitted empty.");
      return;
    }
    if (totalWeightage !== 100) {
      setValidationError(`Total weightage must equal exactly 100%. Current total is ${totalWeightage}%.`);
      return;
    }
    const invalidGoal = goals.find(g => Number(g.weightage) < 10);
    if (invalidGoal) {
      setValidationError(`Minimum weightage per individual goal must be >= 10%.`);
      return;
    }

    setValidationError('');
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/goals/submit`, {
        method: 'POST',
        body: JSON.stringify({
          sheet_id: sheet.id,
          goals: goals.map(g => ({
            id: g.id > 1000000 ? null : g.id, // strip client-side temp IDs
            thrust_area: g.thrust_area,
            title: g.title,
            description: g.description,
            uom: g.uom,
            target_value: Number(g.target_value),
            weightage: Number(g.weightage),
            deadline: g.deadline || null
          }))
        })
      });
      showToast("Goal sheet submitted successfully!");
      // Simulate status change locally to immediately reflect UI transition if desired
      setSheet(prev => ({ ...prev, status: 'Pending_Approval' }));
    } catch (err) {
      setValidationError(err.message);
    }
  };

  const isReadOnly = sheet && (sheet.status === 'Pending_Approval' || sheet.status === 'Approved');

  const renderGoalSettingMatrix = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Weightage Banner */}
      <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm transition-colors duration-500 ${
        totalWeightage === 100 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'
      }`}>
        <div className="flex items-center gap-3">
          {totalWeightage === 100 ? <CheckCircle className="text-emerald-500" size={24}/> : <AlertTriangle className="text-amber-500" size={24}/>}
          <div>
            <h3 className={`font-bold ${totalWeightage === 100 ? 'text-emerald-800' : 'text-amber-800'}`}>
              Total Sheet Weightage
            </h3>
            <p className={`text-sm ${totalWeightage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Allocated: {totalWeightage}% / 100%
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm font-semibold text-slate-400">{goals.length}/8 Goals Added</span>
          {!isReadOnly && (
            <button 
              onClick={handleAddGoal} 
              disabled={isMaxGoalsReached || (cycleStatus && !cycleStatus.can_edit_goals)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                isMaxGoalsReached || (cycleStatus && !cycleStatus.can_edit_goals) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
            >
              <Plus size={16}/> Add Goal Row
            </button>
          )}
          <button 
            onClick={handleSubmitSheet}
            disabled={isReadOnly || (cycleStatus && !cycleStatus.can_edit_goals)}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center shadow-sm transition-colors
              ${(isReadOnly || (cycleStatus && !cycleStatus.can_edit_goals)) ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            <Send size={16} className="mr-2" />
            {isReadOnly ? 'Submitted' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center shadow-sm">
          <AlertTriangle className="mr-3 flex-shrink-0" size={20} />
          <span className="font-medium text-sm">{validationError}</span>
        </div>
      )}
      {cycleStatus && cycleStatus.phase === "CLOSED" && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-center shadow-sm">
          <Clock className="mr-3 flex-shrink-0" size={20} />
          <span className="font-medium text-sm">Action windows are currently closed. Next tracking window opens in July/Oct/Jan/Mar.</span>
        </div>
      )}

      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10/50">
                <th className="px-4 py-4 min-w-[150px]">Thrust Area</th>
                <th className="px-4 py-4 min-w-[200px]">Goal Title</th>
                <th className="px-4 py-4">UoM</th>
                <th className="px-4 py-4 w-28">Target</th>
                <th className="px-4 py-4 w-28">Weight (%)</th>
                <th className="px-4 py-4 w-40">Deadline</th>
                <th className="px-4 py-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {goals.map((g, idx) => (
                <tr key={g.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-4 py-3">
                    <input type="text" value={g.thrust_area} onChange={(e) => handleGoalChange(idx, 'thrust_area', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={g.title} onChange={(e) => handleGoalChange(idx, 'title', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={g.uom} onChange={(e) => handleGoalChange(idx, 'uom', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5">
                      <option value="Numeric_Max">Numeric Max</option>
                      <option value="Numeric_Min">Numeric Min</option>
                      <option value="Timeline">Timeline</option>
                      <option value="Zero_Based">Zero Based</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={g.target_value} onChange={(e) => handleGoalChange(idx, 'target_value', e.target.value)} disabled={g.is_shared || g.uom === 'Zero_Based' || isReadOnly} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={g.weightage} onChange={(e) => handleGoalChange(idx, 'weightage', e.target.value)} disabled={isReadOnly} className="w-full text-sm border-slate-700 rounded-md bg-slate-800/50 text-white p-2 border" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="date" value={g.deadline} onChange={(e) => handleGoalChange(idx, 'deadline', e.target.value)} disabled={g.is_shared || isReadOnly} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!g.is_shared && !isReadOnly && (
                      <button onClick={() => handleDeleteGoal(idx)} className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const handleTrackingChange = (goalId, field, value) => {
    setTrackingState(prev => ({
      ...prev,
      [goalId]: {
        ...(prev[goalId] || {}),
        [selectedQuarter]: {
          ...(prev[goalId]?.[selectedQuarter] || {}),
          [field]: value
        }
      }
    }));
  };

  const handleSaveTracking = async (goalId) => {
    const data = trackingState[goalId]?.[selectedQuarter] || {};
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/tracking/employee/update`, {
        method: 'PUT',
        body: JSON.stringify({
          goal_id: goalId,
          quarter: selectedQuarter,
          actual_achievement: data.actual_achievement ? Number(data.actual_achievement) : null,
          status: data.status || 'Not Started',
          completion_date: data.completion_date || null
        })
      });
      showToast(`Quarterly updates synchronized successfully.`);
    } catch (err) {
      showToast(`Sync Error: ${err.message}`);
    }
  };

  const renderTrackingLogger = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2"><Target className="text-indigo-400" /> Quarterly Tracking Logger</h2>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={selectedQuarter} 
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="bg-indigo-600 border-none rounded-md py-1.5 pl-3 pr-8 text-sm font-bold text-white cursor-pointer"
          >
            <option value="Q1">Q1</option><option value="Q2">Q2</option><option value="Q3">Q3</option><option value="Q4">Q4</option>
          </select>
        </div>
      </div>

      {cycleStatus && cycleStatus.phase === "GOAL_SETTING" && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-center shadow-sm">
          <Clock className="mr-3 flex-shrink-0" size={20} />
          <span className="font-medium text-sm">Tracking updates are currently closed. The Q1 Tracking window opens in July.</span>
        </div>
      )}

      <div className="space-y-4">
        {goals.map(g => {
          const tState = trackingState[g.id]?.[selectedQuarter] || {};
          const isZeroBased = g.uom === 'Zero_Based';
          const isLogLocked = cycleStatus && !cycleStatus.can_update_tracking;
          
          return (
            <div key={g.id} className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="bg-slate-800/20 border-b border-white/10 px-6 py-4">
                <span className="font-bold text-white">{g.title}</span>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  {!isZeroBased ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Actual Achievement</label>
                      <input 
                        type="number" 
                        value={tState.actual_achievement || ''} 
                        onChange={(e) => handleTrackingChange(g.id, 'actual_achievement', e.target.value)}
                        disabled={isLogLocked}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-sm">Zero Based Goal</div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Progress Status</label>
                    <select 
                      value={tState.status || 'Not Started'} 
                      onChange={(e) => handleTrackingChange(g.id, 'status', e.target.value)}
                      disabled={isLogLocked}
                      className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5"
                    >
                      <option value="Not Started">Not Started</option><option value="On Track">On Track</option><option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Completion Date</label>
                    <input 
                      type="date" 
                      value={tState.completion_date || ''} 
                      onChange={(e) => handleTrackingChange(g.id, 'completion_date', e.target.value)}
                      disabled={isLogLocked}
                      className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5"
                    />
                  </div>

                  <div>
                    <button 
                      onClick={() => handleSaveTracking(g.id)}
                      disabled={isLogLocked}
                      className={`w-full px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 ${
                        isLogLocked ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Save size={16} /> {isLogLocked ? 'Window Closed' : 'Save Row'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ==========================================
  // Global Shell Rendering
  // ==========================================
  const SkeletonLoader = () => (
    <div className="animate-pulse space-y-6 pt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-16 bg-slate-200 rounded-xl w-full"></div>
      <div className="h-96 bg-slate-200 rounded-xl w-full"></div>
    </div>
  );

  if (loading) return <SkeletonLoader />;

  const isTrackingMode = sheet && sheet.status === 'Approved' && sheet.is_locked;

  return (
    <div className="min-h-screen bg-transparent text-slate-200 font-sans pb-12 selection:bg-indigo-200">
      {/* Toast Notification Popup */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-fade-in border border-slate-700">
          <CheckCircle size={20} className="text-emerald-400" />
          <span className="font-medium">{toast}</span>
        </div>
      )}

      {/* Workspace Header */}
      <header className="bg-transparent border-b border-white/10 relative z-30 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-600 p-2 rounded-xl text-white shadow-sm">
              <Target size={20} />
            </div>
            <h1 className="text-xl font-black leading-relaxed tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-600 hidden sm:block">
              Employee Workspace
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/20 px-3 py-1.5 rounded-lg border border-white/10">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:block">Context</label>
              <select 
                value={xUserId} 
                onChange={(e) => setXUserId(Number(e.target.value))}
                className="bg-transparent border-none py-1 pl-1 pr-6 text-sm font-bold text-white focus:ring-0 cursor-pointer"
              >
                <option value={14}>Mock Employee (ID: 14)</option>
                <option value={15}>Mock Employee (ID: 15)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* State Banner */}
        {sheet && (
          <div className="mb-8 flex items-center gap-3">
            <h2 className="text-2xl font-black text-white">My Goal Sheet (2026 Cycle)</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              sheet.status === 'Approved' ? '!bg-emerald-500/10 !text-emerald-500 border border-emerald-500/20' :
              sheet.status === 'Pending_Approval' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
              sheet.status === 'Rework' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
              'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {sheet.status.replace('_', ' ')} {sheet.is_locked ? ' (LOCKED)' : ''}
            </span>
          </div>
        )}

        {!sheet ? (
          <div className="bg-slate-900/50 backdrop-blur-sm p-12 rounded-xl border border-white/10 text-center shadow-sm">
            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-200">No Active Goal Sheet</h3>
            <p className="text-slate-400 mt-2">You do not currently have a goal sheet assigned for this cycle.</p>
          </div>
        ) : (
          isTrackingMode ? renderTrackingLogger() : renderGoalSettingMatrix()
        )}
      </main>
    </div>
  );
};

export default EmployeeWorkspace;
