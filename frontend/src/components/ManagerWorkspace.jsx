import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, CheckCircle, FileText, AlertTriangle, ChevronRight, 
  Target, BarChart2, MessageSquare, Save, UserCheck, ShieldCheck, ArrowLeft,
  Activity, Calendar
} from 'lucide-react';

const ManagerWorkspace = () => {
  const [xUserId, setXUserId] = useState(4); // Default to L1 Manager ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState('');
  
  // Dashboard State
  const [teamMembers, setTeamMembers] = useState([]);
  
  // Active Action State
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSheet, setEmployeeSheet] = useState(null);
  const [employeeGoals, setEmployeeGoals] = useState([]);
  const [employeeTracking, setEmployeeTracking] = useState([]);
  
  // Edits State
  const [goalEdits, setGoalEdits] = useState({});
  const [managerComments, setManagerComments] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState('Q1');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': String(xUserId), // Strict enforcement of Manager context
        ...options.headers,
      }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.detail || `Request failed: ${res.status}`);
    }
    return res.json();
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`http://127.0.0.1:8000/api/v1/manager/team`);
      setTeamMembers(data || []);
    } catch (err) {
      setError("Failed to load team data: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [xUserId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleSelectEmployee = async (emp) => {
    if (emp.status === 'Draft' || emp.status === 'Rework') {
      showToast("This sheet is currently with the employee and cannot be reviewed yet.");
      return;
    }
    
    setLoading(true);
    setSelectedEmployee(emp);
    
    try {
      const data = await fetchWithAuth(`http://127.0.0.1:8000/api/v1/manager/employee/${emp.id}/tracking`);
      setEmployeeSheet(data.sheet);
      setEmployeeGoals(data.goals);
      setEmployeeTracking(data.tracking);
      setGoalEdits({});
      setManagerComments({});
    } catch (err) {
      showToast("Failed to load employee details: " + err.message);
      setSelectedEmployee(null);
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (goalId, field, value) => {
    setGoalEdits(prev => ({
      ...prev,
      [goalId]: {
        ...(prev[goalId] || {}),
        [field]: value
      }
    }));
  };

  const handleReviewAction = async (actionStatus) => {
    try {
      const editsArray = Object.entries(goalEdits).map(([gId, edit]) => ({
        goal_id: Number(gId),
        ...(edit.target_value && { target_value: Number(edit.target_value) }),
        ...(edit.weightage && { weightage: Number(edit.weightage) })
      }));
      
      await fetchWithAuth(`http://127.0.0.1:8000/api/v1/manager/review/${employeeSheet.id}`, {
        method: 'POST',
        body: JSON.stringify({
          status: actionStatus,
          goal_edits: editsArray.length > 0 ? editsArray : null
        })
      });
      
      showToast(`Sheet successfully updated to ${actionStatus.replace('_', ' ')}!`);
      setSelectedEmployee(null);
      loadDashboard();
    } catch (err) {
      showToast(`Review Error: ${err.message}`);
    }
  };

  const handleCheckinSubmit = async (goalId) => {
    const comment = managerComments[goalId];
    if (!comment || comment.trim() === '') {
      showToast("Feedback comment is mandatory for compliance.");
      return;
    }
    
    try {
      await fetchWithAuth(`http://127.0.0.1:8000/api/v1/tracking/manager/checkin`, {
        method: 'POST',
        body: JSON.stringify({
          goal_id: goalId,
          quarter: selectedQuarter,
          manager_comment: comment
        })
      });
      showToast(`Manager check-in successfully logged for goal ${goalId}!`);
    } catch (err) {
      showToast(`Check-in Error: ${err.message}`);
    }
  };

  // ==========================================
  // VIEW: Team Summary Dashboard
  // ==========================================
  const renderDashboard = () => {
    const awaitingReviewCount = teamMembers.filter(m => m.status === 'Pending_Approval').length;
    
    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Direct Reports</p>
                <p className="text-3xl font-black text-white mt-1">{teamMembers.length}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl text-blue-600"><Users size={28} /></div>
            </div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Awaiting Review</p>
                <p className="text-3xl font-black text-indigo-600 mt-1">{awaitingReviewCount}</p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl text-indigo-600"><FileText size={28} /></div>
            </div>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Approved & Locked</p>
                <p className="text-3xl font-black text-emerald-600 mt-1">
                  {teamMembers.filter(m => m.status === 'Approved').length}
                </p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600"><ShieldCheck size={28} /></div>
            </div>
          </div>
        </div>

        {/* Team Grid */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-5 border-b border-white/10 bg-transparent flex justify-between items-center">
            <h3 className="text-lg font-black leading-relaxed text-white flex items-center">
              <UserCheck className="mr-2 text-indigo-500" size={20} /> Team Members Overview
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6 gap-6">
            {teamMembers.map((member) => (
              <div 
                key={member.id} 
                onClick={() => handleSelectEmployee(member)}
                className={`border rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-1 ${
                  member.status === 'Pending_Approval' ? 'border-indigo-300 bg-indigo-50/30' :
                  member.status === 'Approved' ? 'border-emerald-200 bg-slate-900/50 backdrop-blur-sm border-white/10' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-white text-lg">{member.name}</h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{member.department}</p>
                  </div>
                  <ChevronRight className="text-slate-400" />
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.status === 'Pending_Approval' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    member.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {member.status.replace('_', ' ')}
                  </span>
                  
                  {member.status === 'Pending_Approval' && (
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400 italic">
                You currently have no direct reports assigned.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW A: Inline Goal Sheet Review
  // ==========================================
  const renderReviewPanel = () => (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => setSelectedEmployee(null)} className="flex items-center text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-4">
        <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
      </button>

      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black leading-relaxed tracking-tight text-white flex items-center gap-2">
              <FileText className="text-indigo-500" /> Goal Sheet Review: {selectedEmployee.name}
            </h2>
            <p className="text-sm font-medium text-slate-400 mt-1">Reviewing proposed goals for Cycle 2026.</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleReviewAction('Rework')}
              className="bg-slate-900/50 backdrop-blur-sm border-white/10 border border-rose-200 hover:bg-rose-50 text-rose-600 px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <AlertTriangle size={16} /> Return for Rework
            </button>
            <button 
              onClick={() => handleReviewAction('Approved')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <CheckCircle size={16} /> Approve & Lock Sheet
            </button>
          </div>
        </div>

        <div className="p-6 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10/50">
                <th className="px-4 py-4">Thrust Area</th>
                <th className="px-4 py-4 min-w-[250px]">Goal Title</th>
                <th className="px-4 py-4">UoM</th>
                <th className="px-4 py-4 w-32">Target Override</th>
                <th className="px-4 py-4 w-32">Weight Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {employeeGoals.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-4 font-bold text-slate-200">{g.thrust_area}</td>
                  <td className="px-4 py-4 font-medium text-white">{g.title}</td>
                  <td className="px-4 py-4 text-slate-400">
                    <span className="bg-slate-800/30 px-2 py-1 rounded-md text-xs font-bold">{g.uom.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      placeholder={g.target_value.toString()}
                      value={goalEdits[g.id]?.target_value || ''}
                      onChange={(e) => handleEditChange(g.id, 'target_value', e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input 
                      type="number" 
                      placeholder={`${g.weightage}%`}
                      value={goalEdits[g.id]?.weightage || ''}
                      onChange={(e) => handleEditChange(g.id, 'weightage', e.target.value)}
                      className="w-full text-sm bg-slate-900 border border-slate-700 text-white rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // ==========================================
  // VIEW B: Quarterly Check-in Logging
  // ==========================================
  const renderCheckinPanel = () => (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => setSelectedEmployee(null)} className="flex items-center text-sm font-bold text-slate-400 hover:text-emerald-600 transition-colors mb-4">
        <ArrowLeft size={16} className="mr-1" /> Back to Dashboard
      </button>

      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl shadow-md border border-slate-700 overflow-hidden">
        <div className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black leading-relaxed tracking-tight text-white flex items-center gap-2">
              <Activity className="text-emerald-400" /> Quarterly Performance Check-in: {selectedEmployee.name}
            </h2>
            <p className="text-sm font-medium text-slate-300 mt-1">Reviewing locked goals and actual achievements.</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-600">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-2">Tracking Quarter</label>
            <select 
              value={selectedQuarter} 
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="bg-emerald-600 border-none rounded-md py-1.5 pl-3 pr-8 text-sm font-bold text-white focus:ring-0 cursor-pointer shadow-sm"
            >
              <option value="Q1">Q1 Performance</option>
              <option value="Q2">Q2 Performance</option>
              <option value="Q3">Q3 Performance</option>
              <option value="Q4">Q4 Performance</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {employeeGoals.map((g) => {
          const trackData = employeeTracking.find(t => t.goal_id === g.id && t.quarter === selectedQuarter) || {};
          
          return (
            <div key={g.id} className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-transparent flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-lg">{g.title}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{g.thrust_area} • Weight: {g.weightage}%</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Planned Target</p>
                    <p className="font-black text-white mt-1">{g.uom === 'Zero_Based' ? '0 (Zero Based)' : g.target_value}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Actual Value</p>
                    <p className="font-black text-emerald-600 mt-1">{trackData.actual_achievement !== undefined ? trackData.actual_achievement : 'Pending'}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-900/50 backdrop-blur-sm border-white/10 flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <MessageSquare size={14}/> Manager Check-in Feedback / Comments
                  </label>
                  <textarea 
                    rows="3"
                    placeholder="Enter comprehensive feedback for this quarter's performance..."
                    value={managerComments[g.id] || trackData.manager_comment || ''}
                    onChange={(e) => setManagerComments({...managerComments, [g.id]: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors resize-none"
                  ></textarea>
                </div>
                <div className="flex flex-col justify-end">
                  <button 
                    onClick={() => handleCheckinSubmit(g.id)}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Save size={16} /> Submit Check-in Log
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  // ==========================================
  // Global Shell Rendering
  // ==========================================
  const SkeletonLoader = () => (
    <div className="animate-pulse space-y-6 pt-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-24 bg-slate-200 rounded-xl w-full"></div>
      <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
    </div>
  );

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
              <Users size={20} />
            </div>
            <h1 className="text-xl font-black leading-relaxed tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-600 hidden sm:block">
              Manager Workspace
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/20 px-3 py-1.5 rounded-lg border border-slate-200">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:block">Persona</label>
              <select 
                value={xUserId} 
                onChange={(e) => { setXUserId(Number(e.target.value)); setSelectedEmployee(null); }}
                className="bg-transparent border-none py-1 pl-1 pr-6 text-sm font-bold text-white focus:ring-0 cursor-pointer"
              >
                <option value={4}>L1 Manager (ID: 4)</option>
                <option value={5}>L1 Manager (ID: 5)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* API Error Banner */}
        {error && (
          <div className="mb-8 bg-rose-50 border border-rose-200 p-5 rounded-xl shadow-sm">
            <div className="flex items-center text-rose-800">
              <AlertTriangle size={22} className="mr-3" />
              <p className="font-bold">{error}</p>
            </div>
          </div>
        )}

        {loading && !selectedEmployee ? (
          <SkeletonLoader />
        ) : !selectedEmployee ? (
          renderDashboard()
        ) : selectedEmployee.status === 'Pending_Approval' ? (
          renderReviewPanel()
        ) : (
          renderCheckinPanel()
        )}
      </main>
    </div>
  );
};

export default ManagerWorkspace;
