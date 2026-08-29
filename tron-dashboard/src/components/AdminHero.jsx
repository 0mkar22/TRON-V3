import React from 'react';

export default function AdminHero({ companyName, fullName, user, handleLogout }) {
  return (
    <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
      <div className="text-center md:text-left relative z-10">
        <div className="inline-flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 tracking-wider mb-4 uppercase">
          <span>🏢</span><span>{companyName}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">Welcome back, {fullName.split(' ')[0]}</h1>
        <p className="text-sm font-semibold text-indigo-600 mt-2 bg-indigo-50 inline-block px-3 py-1 rounded-md">
          Logged in as: {user?.email} <span className="ml-2 text-indigo-400 font-normal">(Admin)</span>
        </p>
        <p className="text-gray-500 mt-4 text-lg max-w-2xl">Your automated project management and AI code review engine is online and monitoring your repositories.</p>
      </div>
      <div className="mt-8 md:mt-0 flex flex-col items-center md:items-end space-y-5 relative z-10">
          <span className="inline-flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm border border-emerald-100 shadow-sm">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2.5 animate-pulse"></span> Engine Active
          </span>
          <form action={handleLogout}><button type="submit" className="text-sm px-4 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 font-bold rounded-lg transition-colors">Log out</button></form>
      </div>
    </div>
  );
}
