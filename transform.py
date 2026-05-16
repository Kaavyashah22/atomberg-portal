import os
import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Cards
    content = content.replace('bg-white p-6 rounded-lg shadow-sm border border-slate-200', 'bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800')
    content = content.replace('bg-white p-6 rounded-xl shadow-sm border border-slate-200', 'bg-slate-900/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-800')
    content = content.replace('bg-white rounded-lg shadow-sm border border-slate-200', 'bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800')
    content = content.replace('bg-white rounded-xl shadow-sm border border-slate-200', 'bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800')
    
    # Headers
    content = content.replace('bg-slate-50 text-slate-600 text-sm border-b border-slate-200', 'text-slate-400 text-sm border-b border-slate-800')
    content = content.replace('bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200', 'text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800/50')
    content = content.replace('border-b border-slate-200 bg-slate-50', 'border-b border-slate-800 bg-transparent')
    
    # Text colors
    content = content.replace('text-slate-800', 'text-white')
    content = content.replace('text-slate-700', 'text-slate-200')
    content = content.replace('text-slate-600', 'text-slate-300')
    content = content.replace('text-slate-500', 'text-slate-400')
    
    # Backgrounds
    content = content.replace('bg-slate-100 text-slate-900', 'bg-transparent text-slate-200')
    content = content.replace('bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm', 'bg-transparent border-b border-slate-800 sticky top-0 z-40')
    content = content.replace('bg-slate-50 border-t border-slate-200', 'bg-slate-800/30 border-t border-slate-800')
    content = content.replace('bg-slate-50/50', 'bg-slate-800/20')
    
    # Inputs
    content = content.replace('border-slate-300 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white', 'border-slate-700 rounded-lg p-2.5 border focus:ring-2 focus:ring-indigo-500 bg-slate-800/50 focus:bg-slate-800 text-white')
    content = content.replace('border-slate-200 rounded-md', 'border-slate-700 rounded-md bg-slate-800/50 text-white')
    content = content.replace('border border-slate-300 rounded-lg px-4 py-2.5', 'border border-slate-700 bg-slate-800/50 text-white rounded-lg px-4 py-2.5')
    
    # Tables rows
    content = content.replace('border-b border-slate-100 hover:bg-slate-50', 'border-b border-slate-800/50 hover:bg-slate-800/30 even:bg-slate-800/10')
    content = content.replace('divide-y divide-slate-100', 'divide-y divide-slate-800/50')
    
    # Status Badges
    content = re.sub(
        r"bg-slate-200 text-slate-700 border-slate-300",
        r"bg-slate-800 text-slate-400 border-slate-700",
        content
    )
    content = re.sub(
        r"bg-indigo-100 text-indigo-700 border-indigo-200",
        r"bg-amber-500/10 text-amber-500 border border-amber-500/20",
        content
    )
    content = re.sub(
        r"bg-emerald-100 text-emerald-700 border-emerald-200",
        r"bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
        content
    )
    content = re.sub(
        r"bg-rose-50 text-rose-700 border-rose-200",
        r"bg-rose-500/10 text-rose-500 border border-rose-500/20",
        content
    )
    content = re.sub(
        r"bg-blue-50 text-blue-700 border-blue-200",
        r"bg-amber-500/10 text-amber-500 border border-amber-500/20",
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)

base = '/Users/kaavyashah/Desktop/atomberg/frontend/src/components'
for file in ['AdminDashboard.jsx', 'EmployeeWorkspace.jsx', 'ManagerWorkspace.jsx']:
    update_file(f'{base}/{file}')
