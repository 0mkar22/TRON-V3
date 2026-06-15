"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import axios from 'axios';
import AssignmentForm from './AssignmentForm';
import { deleteAssignmentAction } from './actions';

export default function TeamManagementPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    
    const [teamMembers, setTeamMembers] = useState([]);
    const [workflows, setWorkflows] = useState([]);
    const [assignments, setAssignments] = useState([]); // 🌟 NEW STATE
    const [loadingData, setLoadingData] = useState(true);
    
    const supabase = createClient();

    const fetchDashboardData = useCallback(async () => {
        setLoadingData(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: currentUserData } = await supabase
                .from('users')
                .select('org_id')
                .eq('id', user.id)
                .single();

            if (currentUserData?.org_id) {
                // Fetch Team Members
                const { data: members } = await supabase
                    .from('users')
                    .select('*')
                    .eq('org_id', currentUserData.org_id)
                    .order('created_at', { ascending: true });
                
                // Fetch Active Workflows (Repositories)
                const { data: repos } = await supabase
                    .from('repositories')
                    .select('*')
                    .eq('org_id', currentUserData.org_id)
                    .order('created_at', { ascending: false });

                // 🌟 NEW: Fetch Active Assignments
                const { data: assigns } = await supabase
                    .from('project_assignments')
                    .select('*')
                    .eq('org_id', currentUserData.org_id)
                    .order('created_at', { ascending: false });

                setTeamMembers(members || []);
                setWorkflows(repos || []);
                setAssignments(assigns || []);
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoadingData(false);
        }
    }, [supabase]);

    useEffect(() => {
        Promise.resolve().then(fetchDashboardData);
    }, [fetchDashboardData]);

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error("You must be logged in to invite developers.");

            const API_BASE_URL = process.env.BACKEND_URL || 'https://tron-v3-1.onrender.com'; 
            
            const response = await axios.post(
                `${API_BASE_URL}/api/admin/invite-developer`,
                { email: email.trim() },
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );

            setStatus({ type: 'success', message: response.data.message });
            setEmail('');
            fetchDashboardData();

        } catch (error) {
            setStatus({ 
                type: 'error', 
                message: error.response?.data?.error || error.message || "Failed to send invite." 
            });
        } finally {
            setLoading(false);
        }
    };

    // 🌟 NEW: Handle Revoking Access
    const handleRevoke = async (assignmentId) => {
        const formData = new FormData();
        formData.append('assignmentId', assignmentId);
        await deleteAssignmentAction(formData);
        fetchDashboardData(); // Refresh the list instantly
    };

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-8 font-sans">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Team Management</h1>
                <p className="text-gray-500 mt-2 text-lg">Build your engineering team and configure their access.</p>
            </div>

            {/* CARD 1: Invite Form */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Invite New Developer</h2>
                        <p className="text-sm text-gray-500 mt-1">They will receive an email to join your workspace.</p>
                    </div>
                    <div className="hidden sm:flex h-12 w-12 bg-indigo-50 rounded-full items-center justify-center text-indigo-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                </div>
                
                <div className="p-6 sm:p-8">
                    <form onSubmit={handleInvite} className="max-w-2xl">
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <input 
                                    type="email" 
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="developer@yourcompany.com"
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>
                        </div>

                        {status.message && (
                            <div className={`mb-6 p-4 rounded-xl text-sm flex items-start ${
                                status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                            }`}>
                                <span className="font-medium">{status.message}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || !email}
                            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 disabled:opacity-60"
                        >
                            {loading ? 'Sending Invite...' : 'Send Invitation'}
                        </button>
                    </form>
                </div>
            </div>

            {/* CARD 2: Project Assignment */}
            <div onClick={fetchDashboardData}>
                {/* Wrapping in a div with onClick as a simple hack to refresh the list when AssignmentForm submits */}
                <AssignmentForm developers={teamMembers} workflows={workflows} />
            </div>

            {/* 🌟 CARD 3: Active Workflow Assignments (NEW) */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-8">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Active Workflow Assignments</h2>
                        <p className="text-sm text-gray-500 mt-1">Developers with explicit access to specific mapped repositories.</p>
                    </div>
                    <div className="hidden sm:flex h-12 w-12 bg-sky-50 rounded-full items-center justify-center text-sky-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                </div>
                
                <div className="p-0">
                    {loadingData ? (
                        <div className="p-12 text-center text-gray-500">Loading assignments...</div>
                    ) : assignments.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No developers have been assigned to workflows yet.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {assignments.map((assignment) => {
                                const dev = teamMembers.find(m => m.id === assignment.user_id);
                                const repo = workflows.find(r => r.id === assignment.repository_id);
                                
                                return (
                                    <li key={assignment.id} className="p-6 sm:p-8 hover:bg-gray-50/50 transition-colors">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                    {(dev?.full_name || dev?.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {dev?.full_name || dev?.email || 'Unknown Developer'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1 text-xs font-medium text-gray-500">
                                                        <span>Assigned to:</span>
                                                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                            {repo?.repo_name || 'Unknown Repository'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleRevoke(assignment.id)}
                                                className="inline-flex items-center justify-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Revoke Access
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>

            {/* CARD 4: Active Team Roster */}
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Active Team Members</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage your organization&apos;s roster and statuses.</p>
                    </div>
                    <div className="hidden sm:flex h-12 w-12 bg-emerald-50 rounded-full items-center justify-center text-emerald-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                </div>
                
                <div className="p-0">
                    {loadingData ? (
                        <div className="p-12 text-center text-gray-500 flex flex-col items-center">
                            <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading team roster...
                        </div>
                    ) : teamMembers.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No team members found.</div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {teamMembers.map((member) => (
                                <li key={member.id} className="p-6 sm:p-8 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <div className="h-12 w-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-lg shrink-0">
                                                {member.full_name ? member.full_name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="ml-4">
                                                <p className="text-sm font-bold text-gray-900">
                                                    {member.full_name || 'Pending Developer...'}
                                                </p>
                                                <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {member.role === 'admin' ? 'Admin' : 'Developer'}
                                            </span>
                                            
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                member.full_name ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {member.full_name ? 'Active' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}