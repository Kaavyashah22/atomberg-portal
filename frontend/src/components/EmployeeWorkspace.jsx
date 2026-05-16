import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Save, AlertTriangle, CheckCircle, Clock, 
  Target, ShieldAlert, FileText, Send, Trash2, Calendar
} from 'lucide-react';

const EmployeeWorkspace = () => {
  const [xUserId, setXUserId] = useState(14); // Default to Mock Employee
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  
  // Workspace State
  const [sheet, setSheet] = useState(null);
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
      const data = await fetchWithAuth(`http://127.0.0.1:8000/api/v1/goals/sheet/active`);
      setSheet(data.sheet);
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
      await fetchWithAuth(`http://127.0.0.1:8000/api/v1/goals/submit`, {
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

  const renderGoalSettingMatrix = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Weightage Banner */}
      <div className={`p-4 rounded-xl flex items-center justify-between shadow-sm transition-colors duration-500 ${
        totalWeightage === 100 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
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
          <button 
            onClick={handleAddGoal} 
            disabled={isMaxGoalsReached}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
              isMaxGoalsReached ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            <Plus size={16}/> Add Goal Row
          </button>
        </div>
      </div>

      {/* Validation Error Box */}
      {validationError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg flex items-start gap-3 shadow-sm animate-fade-in">
          <ShieldAlert size={20} className="mt-0.5 shrink-0" />
          <p className="font-semibold text-sm">{validationError}</p>
        </div>
      )}

      {/* Goal Matrix Grid */}
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
                    <input type="text" value={g.thrust_area} onChange={(e) => handleGoalChange(idx, 'thrust_area', e.target.value)} disabled={g.is_shared} placeholder="e.g. Financial" className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={g.title} onChange={(e) => handleGoalChange(idx, 'title', e.target.value)} disabled={g.is_shared} placeholder="Title" className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-4 py-3">
                    <select value={g.uom} onChange={(e) => handleGoalChange(idx, 'uom', e.target.value)} disabled={g.is_shared} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                      <option value="Numeric_Max">Numeric Max</option>
                      <option value="Numeric_Min">Numeric Min</option>
                      <option value="Timeline">Timeline</option>
                      <option value="Zero_Based">Zero Based</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={g.target_value} onChange={(e) => handleGoalChange(idx, 'target_value', e.target.value)} disabled={g.is_shared || g.uom === 'Zero_Based'} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={g.weightage} onChange={(e) => handleGoalChange(idx, 'weightage', e.target.value)} className={`w-full text-sm border-slate-700 rounded-md bg-slate-800/50 text-white p-2 border focus:ring-indigo-500 ${Number(g.weightage) < 10 ? 'border-amber-300 bg-amber-50' : ''}`} />
                  </td>
                  <td className="px-4 py-3">
                    <input type="date" value={g.deadline} onChange={(e) => handleGoalChange(idx, 'deadline', e.target.value)} disabled={g.is_shared} className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!g.is_shared && (
                      <button onClick={() => handleDeleteGoal(idx)} className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {goals.length === 0 && (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">No goals added yet. Start building your performance matrix.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-800/30 border-t border-white/10 px-6 py-4 flex justify-end">
          <button 
            onClick={handleSubmitSheet}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
          >
            <Send size={16} /> Submit Goal Sheet
          </button>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // VIEW B: Quarterly Tracking Update Logger
  // ==========================================
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
      await fetchWithAuth(`http://127.0.0.1:8000/api/v1/tracking/employee/update`, {
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
          <h2 className="text-xl font-black leading-relaxed tracking-tight text-white flex items-center gap-2"><Target className="text-indigo-400" /> Quarterly Tracking Logger</h2>
          <p className="text-sm text-slate-300 mt-1">Log your execution metrics. Your sheet is currently locked and approved.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-lg border border-slate-600">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-2">Active Quarter</label>
          <select 
            value={selectedQuarter} 
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="bg-indigo-600 border-none rounded-md py-1.5 pl-3 pr-8 text-sm font-bold text-white focus:ring-0 cursor-pointer shadow-sm"
          >
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {goals.map(g => {
          const tState = trackingState[g.id]?.[selectedQuarter] || {};
          const isZeroBased = g.uom === 'Zero_Based';
          
          return (
            <div key={g.id} className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-slate-800/20 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-md text-xs font-bold mr-3">{g.thrust_area}</span>
                  <span className="font-bold text-white">{g.title}</span>
                </div>
                <div className="flex gap-4 text-sm font-medium text-slate-300">
                  <span>Weight: <span className="text-slate-900 font-bold">{g.weightage}%</span></span>
                  <span>Target: <span className="text-indigo-600 font-bold">{isZeroBased ? '0 (Zero Based)' : g.target_value}</span></span>
                </div>
              </div>
              <div className="p-6 bg-slate-900/50 backdrop-blur-sm border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                  {!isZeroBased ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Actual Achievement</label>
                      <input 
                        type="number" 
                        value={tState.actual_achievement || ''} 
                        onChange={(e) => handleTrackingChange(g.id, 'actual_achievement', e.target.value)}
                        placeholder="Enter metric"
                        className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Metric Not Required</label>
                      <div className="w-full text-sm bg-slate-800/20 text-slate-400 rounded-lg p-2.5 border border-slate-200 italic">Zero Based Goal</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Progress Status</label>
                    <select 
                      value={tState.status || 'Not Started'} 
                      onChange={(e) => handleTrackingChange(g.id, 'status', e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="On Track">On Track</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Completion Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input 
                        type="date" 
                        value={tState.completion_date || ''} 
                        onChange={(e) => handleTrackingChange(g.id, 'completion_date', e.target.value)}
                        className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <button 
                      onClick={() => handleSaveTracking(g.id)}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <Save size={16} /> Save Row
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
            <div className="flex items-center gap-2 bg-slate-800/20 px-3 py-1.5 rounded-lg border border-slate-200">
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
          <div className="bg-slate-900/50 backdrop-blur-sm border-white/10 p-12 rounded-xl border border-slate-200 text-center shadow-sm">
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
