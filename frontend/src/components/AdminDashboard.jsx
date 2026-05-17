import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, BarChart2, ShieldAlert, RefreshCw, 
  Unlock, Users, FileText, CheckCircle, Activity, UserCheck, Ghost, Target
} from 'lucide-react';

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const AdminDashboard = () => {
  const [xUserId, setXUserId] = useState(1);
  const [quarter, setQuarter] = useState('Q1');
  const [activeTab, setActiveTab] = useState('A');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Tab A Data
  const [completionData, setCompletionData] = useState(null);
  const [managerEffectiveness, setManagerEffectiveness] = useState([]);
  
  // Tab B Data
  const [goalDistribution, setGoalDistribution] = useState(null);
  
  // Tab C Data
  const [auditLogs, setAuditLogs] = useState([]);
  const [unlockSheetId, setUnlockSheetId] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  
  // Shared Goal Data
  const [sharedGoal, setSharedGoal] = useState({
    department: 'Sales',
    title: '',
    target_value: 0,
    uom: 'Percentage',
    weightage: 10,
    cycle_year: 2026
  });

  const showToast = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else toast.success(message);
  };

  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': String(xUserId),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.detail || `API Request Failed: ${response.status}`);
    }
    return response.json();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'A') {
        const [compRes, mgrRes] = await Promise.all([
          fetchWithAuth(`${API_BASE_URL}/api/v1/admin/dashboard/completion?current_quarter=${quarter || 'Q1'}`),
          fetchWithAuth(`${API_BASE_URL}/api/v1/analytics/manager-effectiveness?current_quarter=${quarter || 'Q1'}`)
        ]);
        setCompletionData(compRes);
        setManagerEffectiveness(mgrRes || []);
      } else if (activeTab === 'B') {
        const distRes = await fetchWithAuth(`${API_BASE_URL}/api/v1/analytics/goal-distribution?current_quarter=${quarter || 'Q1'}`);
        setGoalDistribution(distRes);
      } else if (activeTab === 'C') {
        const logsRes = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/audit-logs?skip=0&limit=50`);
        setAuditLogs(logsRes);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, quarter, xUserId]);

  const handlePushSharedGoal = async () => {
    if (!sharedGoal.title) return;
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/goals/shared`, {
        method: 'POST',
        body: JSON.stringify(sharedGoal)
      });
      showToast(`Shared goal pushed to ${sharedGoal.department} successfully!`);
      setSharedGoal({ ...sharedGoal, title: '', target_value: 0 }); 
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/export`, {
        headers: { 'X-User-ID': String(xUserId) }
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'atomberg_progress_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerEscalation = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/escalations/trigger-check`, { method: 'POST' });
      showToast(`Escalation Check Success: ${res.report?.new_logs_generated} new logs generated`);
    } catch (err) {
      showToast(`Escalation Error: ${err.message}`);
    }
  };

  const handleEmergencyUnlock = async () => {
    if (!unlockSheetId) return;
    try {
      await fetchWithAuth(`${API_BASE_URL}/api/v1/admin/sheets/${unlockSheetId}/unlock`, { method: 'POST' });
      showToast(`Sheet ${unlockSheetId} unlocked successfully`);
      setUnlockSheetId('');
    } catch (err) {
      showToast(`Unlock Error: ${err.message}`);
    }
  };

  const SkeletonLoader = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
      <div className="glass-card p-1">
        <div className="skeleton h-12 w-full rounded-lg" />
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 w-full rounded-lg mt-1" />)}
      </div>
    </div>
  );

  const renderTabA = () => {
    if (loading) return <SkeletonLoader />;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Summary Ribbon */}
        {completionData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Active Employees</p>
                  <p className="text-3xl font-bold text-white mt-1">{completionData.total_employees}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20"><Users size={20} className="text-white" /></div>
              </div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Goal Sheets Submitted</p>
                  <p className="text-3xl font-bold text-emerald-600 mt-1">
                    {completionData.sheets_submitted ?? 0}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20"><CheckCircle size={20} className="text-white" /></div>
              </div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10 transition-transform hover:-translate-y-1 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Pending Drafts</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{completionData.sheets_pending_draft ?? 0}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20"><FileText size={20} className="text-white" /></div>
              </div>
            </div>
          </div>
        )}

        {/* Manager Effectiveness Leaderboard */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 bg-transparent">
            <h3 className="text-lg font-semibold leading-relaxed text-white flex items-center">
              <UserCheck className="mr-2 text-indigo-500" size={20} /> Manager Effectiveness Leaderboard
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-white/10">
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Manager Name</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Department</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Direct Reports</th>
                  <th className="px-6 py-3 font-semibold uppercase tracking-wider">Compliance Rate</th>
                </tr>
              </thead>
              <tbody>
                {managerEffectiveness.map((mgr) => (
                  <tr key={mgr.manager_id} className="border-b border-white/10/50 hover:bg-slate-800/30 even:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-white">{mgr.manager_name}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-300">{mgr.department}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-300">{mgr.total_direct_reports}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-full bg-slate-800/30 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className={`h-2.5 rounded-full transition-all duration-1000 ${mgr.compliance_rate >= 80 ? 'bg-emerald-500' : mgr.compliance_rate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${mgr.compliance_rate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-slate-200 w-12">{mgr.compliance_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {managerEffectiveness.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                      <Ghost size={48} className="mx-auto text-slate-700 mb-4" />
                      <p className="font-semibold text-slate-300">No Data Available</p>
                      <p className="text-sm italic">Manager effectiveness metrics will populate here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Exceptions Matrix */}
        {completionData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card overflow-hidden border-rose-500/15">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-rose-400">Employees Missing Goal Updates</h3>
              </div>
              <ul className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                {completionData.missing_employee_updates?.length > 0 ? completionData.missing_employee_updates.map((emp) => (
                  <li key={emp.id} className="px-5 py-3 flex justify-between items-center text-sm hover:bg-white/[0.02]">
                    <span className="font-semibold text-slate-200">{emp.name}</span>
                    <span className="bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-rose-500/20">Missing</span>
                  </li>
                )) : <li className="px-5 py-8 text-sm text-slate-500 text-center">No missing updates</li>}
              </ul>
            </div>
            <div className="glass-card overflow-hidden border-amber-500/15">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <h3 className="text-sm font-bold text-amber-400">Managers Missing Check-ins</h3>
              </div>
              <ul className="divide-y divide-white/[0.04] max-h-64 overflow-y-auto">
                {completionData.missing_manager_checkins?.length > 0 ? completionData.missing_manager_checkins.map((item) => (
                  <li key={`${item.employee_id}-${item.goal_id}`} className="px-5 py-3 flex justify-between items-center text-sm hover:bg-white/[0.02]">
                    <span className="font-semibold text-slate-200">{item.employee_name} — {item.goal_title}</span>
                    <span className="bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20">Overdue</span>
                  </li>
                )) : <li className="px-5 py-8 text-sm text-slate-500 text-center">No missing check-ins</li>}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabB = () => {
    if (loading) return <SkeletonLoader />;
    return (
      <div className="space-y-6 animate-fade-in">
        {goalDistribution && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Thrust Area Breakdown */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-transparent">
                <h3 className="text-lg font-semibold leading-relaxed text-white flex items-center">
                  <Activity className="mr-2 text-indigo-500" size={20} /> Thrust Area Breakdown
                </h3>
              </div>
              <div className="p-6">
                <div className="space-y-5">
                  {goalDistribution.by_thrust_area?.map((item, idx) => {
                    // Calculate relative percentage for visualization
                    const maxCount = Math.max(...goalDistribution.by_thrust_area.map(x => x.count), 1);
                    const widthPercent = (item.count / maxCount) * 100;
                    
                    return (
                      <div key={idx} className="flex flex-col">
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-semibold text-slate-200">{item.thrust_area}</span>
                          <span className="text-slate-400 font-medium bg-slate-800/30 px-2 py-0.5 rounded-full">{item.count} Goals</span>
                        </div>
                        <div className="w-full bg-slate-800/30 rounded-full h-2.5 overflow-hidden">
                          <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${widthPercent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                  {(!goalDistribution.by_thrust_area || goalDistribution.by_thrust_area.length === 0) && (
                    <p className="text-center text-slate-400 py-8 italic">No thrust area distribution data available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* UoM Tracking State */}
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 bg-transparent">
                <h3 className="text-lg font-semibold leading-relaxed text-white flex items-center">
                  <BarChart2 className="mr-2 text-indigo-500" size={20} /> UoM Tracking State
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  {goalDistribution.by_uom_and_status?.map((item, idx) => {
                    const statusColor = item.status === 'Completed' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-100' :
                                      item.status === 'On Track' ? 'bg-blue-50 text-blue-800 border-blue-200 shadow-blue-100' :
                                      'bg-slate-800/20 text-white border-white/10 shadow-none';
                    return (
                      <div key={idx} className={`p-5 rounded-xl border shadow-sm ${statusColor} flex flex-col items-center justify-center text-center transition-transform hover:-translate-y-1 duration-300`}>
                        <span className="text-3xl font-black mb-1">{item.count}</span>
                        <span className="text-xs font-bold uppercase tracking-widest mt-1 opacity-70">{item.uom.replace('_', ' ')}</span>
                        <span className="text-sm font-semibold mt-2">{item.status.replace('_', ' ')}</span>
                      </div>
                    )
                  })}
                  {(!goalDistribution.by_uom_and_status || goalDistribution.by_uom_and_status.length === 0) && (
                    <p className="col-span-2 text-center text-slate-400 py-8 italic">No active unit of measure tracking data available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTabC = () => {
    if (loading) return <SkeletonLoader />;
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Action Ribbon */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-gradient-to-r from-slate-800 to-slate-900 p-6 rounded-lg shadow-md border border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold leading-relaxed text-white flex items-center">
                <ShieldAlert className="mr-2 text-rose-400" size={20} /> System Escalation Engine
              </h3>
              <p className="text-sm text-slate-300 mt-1">Force an immediate evaluation of all active escalation rules.</p>
            </div>
            <button 
              onClick={handleTriggerEscalation}
              className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-sm"
            >
              <RefreshCw size={16} /> Trigger Matrix Check
            </button>
          </div>

          <div className="flex-1 bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-bold leading-relaxed text-white flex items-center">
                <Unlock className="mr-2 text-amber-500" size={20} /> Emergency Sheet Bypass
              </h3>
              <p className="text-sm text-slate-400 mt-1">Force unlock a Goal Sheet for immediate administrative corrections.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <input 
                type="number" 
                placeholder="Sheet ID"
                value={unlockSheetId}
                onChange={(e) => setUnlockSheetId(e.target.value)}
                className="border border-slate-700 bg-slate-800/50 text-white rounded-lg px-4 py-2.5 text-sm w-full sm:w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
              <button 
                onClick={handleEmergencyUnlock}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors shadow-sm"
              >
                Force Unlock
              </button>
            </div>
          </div>
        </div>

        {/* Shared Goals Push Section */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold leading-relaxed text-white flex items-center">
              <Target className="mr-2 text-blue-500" size={20} /> Departmental Shared Goals Push
            </h3>
            <p className="text-sm text-slate-400 mt-1">Broadcast a top-down goal to all employees in a department.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Dept</label>
              <select 
                value={sharedGoal.department}
                onChange={(e) => setSharedGoal({...sharedGoal, department: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="Sales">Sales</option>
                <option value="Engineering">Engineering</option>
                <option value="HR">HR</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Goal Title</label>
              <input 
                type="text" 
                placeholder="e.g. Achieve $1M Revenue"
                value={sharedGoal.title}
                onChange={(e) => setSharedGoal({...sharedGoal, title: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Target</label>
              <input 
                type="number" 
                value={sharedGoal.target_value}
                onChange={(e) => setSharedGoal({...sharedGoal, target_value: Number(e.target.value)})}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Weight %</label>
              <input 
                type="number" 
                value={sharedGoal.weightage}
                onChange={(e) => setSharedGoal({...sharedGoal, weightage: Number(e.target.value)})}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-1">
              <button 
                onClick={handlePushSharedGoal}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-bold transition-colors shadow-md"
              >
                Push Goal
              </button>
            </div>
          </div>
        </div>

        {/* Audit Ledger Table */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 bg-transparent flex justify-between items-center">
            <h3 className="text-lg font-bold leading-relaxed text-white flex items-center">
              <FileText className="mr-2 text-indigo-500" size={20} /> Governance Audit Ledger
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-white/10/50">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Actor ID</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Target Entities</th>
                  <th className="px-6 py-4">Details</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {auditLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="border-b border-white/10/50 hover:bg-slate-800/30 even:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                        {log.timestamp ? (new Date(log.timestamp).toString() !== 'Invalid Date' ? new Date(log.timestamp).toLocaleDateString() : 'N/A') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">User {log.modified_by}</td>
                      <td className="px-6 py-4">
                        <span className="bg-atomberg-500/10 text-atomberg-400 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-atomberg-500/20">
                            {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        <div className="flex gap-2">
                            {log.sheet_id && <span className="bg-slate-800/30 px-2 py-1 rounded-md text-xs font-bold">Sheet #{log.sheet_id}</span>}
                            {log.goal_id && <span className="bg-slate-800/30 px-2 py-1 rounded-md text-xs font-bold">Goal #{log.goal_id}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-atomberg-400 hover:text-atomberg-300 text-[10px] font-semibold uppercase tracking-wider bg-atomberg-500/10 hover:bg-atomberg-500/20 border border-atomberg-500/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          {expandedLog === log.id ? 'Close Drawer' : 'Inspect JSON'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-slate-800 border-b border-slate-900">
                        <td colSpan="5" className="px-6 py-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs font-bold text-rose-400 mb-2 uppercase tracking-widest flex items-center"><ShieldAlert size={14} className="mr-1"/> Old Values</p>
                              <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-xs overflow-x-auto border border-slate-700">
                                {log.old_values ? JSON.stringify(log.old_values, null, 2) : 'null'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-widest flex items-center"><CheckCircle size={14} className="mr-1"/> New Values</p>
                              <pre className="bg-slate-900 text-slate-300 p-4 rounded-lg text-xs overflow-x-auto border border-slate-700">
                                {log.new_values ? JSON.stringify(log.new_values, null, 2) : 'null'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {auditLogs.length === 0 && (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400 italic">No governance audit logs available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="text-slate-200 font-sans pb-6">

      {/* Controls Bar */}
      <div className="border-b border-white/10 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-atomberg-600 to-atomberg-500 flex items-center justify-center shadow-lg shadow-atomberg-500/20">
              <LayoutDashboard size={16} className="text-white" />
            </div>
            <span className="text-sm font-extrabold text-white tracking-tight hidden sm:block">Admin Console</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-white/10">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 hidden sm:block">Persona</label>
              <select 
                value={xUserId} 
                onChange={(e) => setXUserId(Number(e.target.value))}
                className="bg-transparent border-none py-1 pl-1 pr-6 text-sm font-bold text-white focus:ring-0 cursor-pointer"
              >
                <option value={1}>Global Admin (ID: 1)</option>
                <option value={2}>HR Admin (ID: 2)</option>
                <option value={3}>System Admin (ID: 3)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 bg-indigo-600/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-400 hidden sm:block">Quarter</label>
              <select 
                value={quarter} 
                onChange={(e) => setQuarter(e.target.value)}
                className="bg-transparent text-indigo-300 border-none py-1 pl-1 pr-6 text-sm font-black focus:ring-0 cursor-pointer"
              >
                <option value="Q1">Q1 Tracker</option>
                <option value="Q2">Q2 Tracker</option>
                <option value="Q3">Q3 Tracker</option>
                <option value="Q4">Q4 Tracker</option>
              </select>
            </div>
            
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <FileText size={14} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-12">
        {/* API Error Banner */}
        {error && (
          <div className="mb-6 glass-card border-rose-500/20 p-4 flex items-center gap-3">
            <ShieldAlert size={18} className="text-rose-400" />
            <p className="text-sm font-medium text-rose-300">{error}</p>
          </div>
        )}

        {/* Admin Workspace Tabs */}
        <div className="mb-8 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-2 overflow-x-auto">
          <nav className="flex space-x-2 min-w-max">
            <button
              onClick={() => setActiveTab('A')}
              className={`py-3 px-6 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'A' 
                  ? 'bg-atomberg-500/15 text-atomberg-400 shadow-sm border border-atomberg-500/20' 
                  : 'bg-transparent text-slate-400 hover:bg-slate-800/20 hover:text-white'
              }`}
            >
              <Activity size={18} /> Compliance & Metrics
            </button>
            <button
              onClick={() => setActiveTab('B')}
              className={`py-3 px-6 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'B' 
                  ? 'bg-atomberg-500/15 text-atomberg-400 shadow-sm border border-atomberg-500/20' 
                  : 'bg-transparent text-slate-400 hover:bg-slate-800/20 hover:text-white'
              }`}
            >
              <BarChart2 size={18} /> Goal Distribution
            </button>
            <button
              onClick={() => setActiveTab('C')}
              className={`py-3 px-6 rounded-lg font-bold text-sm flex items-center gap-2 transition-all duration-200 ${
                activeTab === 'C' 
                  ? 'bg-atomberg-500/15 text-atomberg-400 shadow-sm border border-atomberg-500/20' 
                  : 'bg-transparent text-slate-400 hover:bg-slate-800/20 hover:text-white'
              }`}
            >
              <ShieldAlert size={18} /> Governance & Audit
            </button>
          </nav>
        </div>

        {/* Dynamic Tab Content */}
        <div className="transition-all duration-300 ease-in-out">
          {activeTab === 'A' && renderTabA()}
          {activeTab === 'B' && renderTabB()}
          {activeTab === 'C' && renderTabC()}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
