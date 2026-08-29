'use client';
import Link from 'next/link';
import { LayoutDashboard, Cable, Workflow, Users, Activity } from 'lucide-react';

export default function Sidebar({ currentOrg }) {
  return (
    <aside className="w-64 h-screen bg-brutal-bg border-r-4 border-black flex flex-col z-50 relative">
      <div className="p-6 border-b-4 border-black bg-brutal-green flex-shrink-0">
        <h1 className="text-3xl font-black uppercase tracking-tighter">TRON_V3</h1>
        <p className="text-sm font-bold mt-2 font-mono bg-black text-white inline-block px-2 py-1 shadow-brutal">
          {currentOrg?.name || 'WORKSPACE'}
        </p>
      </div>
      <nav className="flex-1 p-6 space-y-4 overflow-y-auto">
        <SidebarItem href="/" label="DASHBOARD" color="hover:bg-brutal-pink" />
        <SidebarItem href="/integrations" label="INTEGRATIONS" color="hover:bg-brutal-blue" />
        <SidebarItem href="/repositories" label="WORKFLOWS" color="hover:bg-brutal-orange" />
        <SidebarItem href="/activity" label="MISSION CTRL" color="hover:bg-brutal-green" />
        <SidebarItem href="/team" label="TEAM ROSTER" color="hover:bg-brutal-pink" />
      </nav>
    </aside>
  );
}

function SidebarItem({ href, label, color }) {
  return (
    <Link href={href} className={`block border-4 border-black p-3 font-black text-lg uppercase transition-all shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg active:translate-x-[4px] active:translate-y-[4px] active:shadow-none bg-white ${color}`}>
      {label}
    </Link>
  );
}
