import React from 'react';

export default function AdminHero({ companyName, fullName, user, handleLogout }) {
  return (
    <div className="bg-white border border-gray-200 rounded-sm p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center relative">
      <div className="text-left">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-mono uppercase tracking-widest rounded-sm border border-gray-200">
            {companyName}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-600">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            System Online
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">
          {user?.email} <span className="text-gray-400">|</span> <span className="text-gray-900">Admin Privileges</span>
        </p>
      </div>
      <div className="mt-4 md:mt-0 flex gap-3">
          <form action={handleLogout}>
            <button type="submit" className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-sm transition-colors font-mono uppercase tracking-wider">
              Terminate Session
            </button>
          </form>
      </div>
    </div>
  );
}
