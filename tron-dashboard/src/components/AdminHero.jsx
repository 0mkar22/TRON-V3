import React from 'react';

export default function AdminHero({ companyName, fullName, user, handleLogout }) {
  return (
    <div className="bg-brutal-orange border-4 border-black shadow-brutal-lg p-8 flex flex-col md:flex-row justify-between items-start md:items-center relative overflow-hidden">
      <div className="text-left relative z-10">
        <div className="flex items-center gap-4 mb-4">
          <span className="px-3 py-1 bg-white text-black font-black uppercase tracking-widest border-2 border-black shadow-brutal">
            {companyName}
          </span>
          <span className="flex items-center gap-2 text-sm font-black font-mono bg-black text-brutal-green px-3 py-1 border-2 border-black">
            <span className="w-2 h-2 bg-brutal-green rounded-full animate-pulse"></span>
            SYS_ONLINE
          </span>
        </div>
        <h1 className="text-5xl font-black text-black tracking-tight uppercase">Dashboard</h1>
        <p className="font-mono text-xl font-bold bg-white border-2 border-black inline-block px-3 py-1 mt-4 shadow-brutal text-black">
          ID: {user?.email} | ROLE: ADMIN
        </p>
      </div>
      <div className="mt-8 md:mt-0 flex gap-4 relative z-10">
          <form action={handleLogout}>
            <button type="submit" className="btn-brutal bg-white text-black px-6 py-4 text-xl hover:bg-brutal-pink">
              TERMINATE SESSION
            </button>
          </form>
      </div>
    </div>
  );
}
