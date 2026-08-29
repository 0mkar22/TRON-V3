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
    const [assignments, setAssignments] = useState([]); 
    const [loadingData, setLoadingData] = useState(true);
    
    const supabase = createClient();

    const fetchDashboardData = useCallback(async () => {
        setLoadingData(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: currentUserData } = await supabase
                .from('organization_members')
                .select('org_id')
                .eq('user_id', user.id)
                .limit(1)
                .then(({data, error}) => ({ data: data?.[0], error }));

            if (currentUserData?.org_id) {
                // Fetch Team Members via junction table
                const { data: orgMembers } = await supabase
                    .from('organization_members')
                    .select(`
                        role,
                        users (id, full_name, email, avatar_url, created_at)
                    `)
                    .eq('org_id', currentUserData.org_id);
                
                const members = orgMembers?.map(om => ({
                    ...om.users,
                    role: om.role
                })) || [];
                
                // Fetch Active Workflows (Repositories)
                const { data: repos } = await supabase
                    .from('repositories')
                    .select('*')
                    .eq('org_id', currentUserData.org_id)
                    .order('created_at', { ascending: false });

                // Fetch Active Assignments
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

    // Handle Revoking Access
    const handleRevoke = async (assignmentId) => {
        const formData = new FormData();
        formData.append('assignmentId', assignmentId);
        await deleteAssignmentAction(formData);
        fetchDashboardData(); 
    };

    // 🌟 NEW: Handle Offboarding/Removing Developer
    const handleRemoveDeveloper = async (userId, userEmail) => {
        if (!window.confirm(`Are you sure you want to remove ${userEmail} from your team? This will instantly revoke all their repository workflows and clear their workspace configuration.`)) {
            return;
        }

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error("Authentication session expired. Please sign in again.");

            const API_BASE_URL = process.env.BACKEND_URL || 'https://tron-v3-1.onrender.com';

            const response = await axios.delete(
                `${API_BASE_URL}/api/admin/team/${userId}`,
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );

            alert(response.data.message);
            fetchDashboardData(); // Instantly update the roster and clear out matching UI elements

        } catch (error) {
            alert(error.response?.data?.error || error.message || "Failed to remove user from team.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-8 font-sans">
            <div className="mb-8 border-b-8 border-black pb-4">
                <h1 className="text-5xl font-black uppercase text-black tracking-tight">Team Management</h1>
                <p className="font-mono text-xl font-bold text-black mt-2">Build your engineering team and configure their access.</p>
            </div>

            {/* CARD 1: Invite Form */}
            <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col mb-8">
                <div className="p-6 border-b-4 border-black bg-brutal-pink flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black uppercase text-black">Invite New Developer</h2>
                        <p className="font-mono font-bold text-black mt-1">They will receive an email to join your workspace.</p>
                    </div>
                    <div className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                </div>
                
                <div className="p-6 sm:p-8">
                    <form onSubmit={handleInvite} className="max-w-2xl">
                        <div className="mb-6">
                            <label className="block font-black text-xl mb-2 uppercase text-black">Email Address</label>
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
                                    className="input-brutal pl-11 text-black"
                                />
                            </div>
                        </div>

                        {status.message && (
                            <div className={`mb-6 p-4 rounded-xl text-sm flex items-start ${
                                status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                            }`}>
                                <span className="font-mono font-bold">{status.message}</span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || !email}
                            className="btn-brutal bg-brutal-blue text-black px-6 py-4 text-xl mt-4 disabled:opacity-50 w-full md:w-auto"
                        >
                            {loading ? 'Sending Invite...' : 'Send Invitation'}
                        </button>
                    </form>
                </div>
            </div>

            {/* CARD 2: Project Assignment */}
            <div onClick={fetchDashboardData}>
                <AssignmentForm 
                    developers={teamMembers} 
                    workflows={workflows} 
                    onSuccess={fetchDashboardData} 
                />
            </div>

            {/* CARD 3: Active Workflow Assignments */}
            <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col mb-8">
                <div className="p-6 border-b-4 border-black bg-brutal-pink flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black uppercase text-black">Active Workflow Assignments</h2>
                        <p className="font-mono font-bold text-black mt-1">Developers with explicit access to specific mapped repositories.</p>
                    </div>
                    <div className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 00Dec-5.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                </div>
                
                <div className="p-0">
                    {loadingData ? (
                        <div className="p-12 text-center text-gray-500">Loading assignments...</div>
                    ) : assignments.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">No developers have been assigned to workflows yet.</div>
                    ) : (
                        <ul className="divide-y-4 divide-black">
                            {assignments.map((assignment) => {
                                const dev = teamMembers.find(m => m.id === assignment.user_id);
                                const repo = workflows.find(r => r.id === assignment.repository_id);
                                
                                return (
                                    <li key={assignment.id} className="p-6 sm:p-8 bg-white hover:bg-brutal-orange transition-colors">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 border-4 border-black bg-black text-white flex items-center justify-center font-black text-xl shrink-0">
                                                    {(dev?.full_name || dev?.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-2xl font-black uppercase text-black">
                                                        {dev?.full_name || dev?.email || 'Unknown Developer'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2 text-sm font-mono font-bold text-black">
                                                        <span>Assigned to:</span>
                                                        <span className="text-black bg-brutal-blue border-2 border-black px-2 py-1 shadow-brutal uppercase">
                                                            {repo?.repo_name || 'Unknown Repository'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleRevoke(assignment.id)}
                                                className="btn-brutal bg-brutal-pink text-black px-6 py-3 w-full sm:w-auto"
                                            >
                                                REVOKE
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
            <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                <div className="p-6 border-b-4 border-black bg-brutal-green flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-black uppercase text-black">Active Team Members</h2>
                        <p className="font-mono font-bold text-black mt-1">Manage your organization&apos;s roster and statuses.</p>
                    </div>
                </div>
                
                <div className="p-0">
                    {loadingData ? (
                        <div className="p-12 text-center text-black font-mono font-bold text-xl uppercase">
                            Loading team roster...
                        </div>
                    ) : teamMembers.length === 0 ? (
                        <div className="p-12 text-center text-black font-mono font-bold text-xl uppercase">No team members found.</div>
                    ) : (
                        <ul className="divide-y-4 divide-black">
                            {teamMembers.map((member) => (
                                <li key={member.id} className="p-6 sm:p-8 bg-white hover:bg-brutal-pink transition-colors">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center">
                                            <div className="h-16 w-16 border-4 border-black bg-black text-white flex items-center justify-center font-black text-2xl shrink-0">
                                                {member.full_name ? member.full_name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="ml-4">
                                                <p className="text-2xl font-black uppercase text-black">
                                                    {member.full_name || 'PENDING...'}
                                                </p>
                                                <p className="text-lg font-mono font-bold text-black mt-1">{member.email}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4">
                                            <span className={`inline-flex items-center border-2 border-black px-4 py-2 text-sm font-black uppercase shadow-brutal ${
                                                member.role === 'admin' ? 'bg-brutal-blue text-black' : 'bg-brutal-orange text-black'
                                            }`}>
                                                {member.role === 'admin' ? 'ADMIN' : 'DEVELOPER'}
                                            </span>
                                            
                                            <span className={`inline-flex items-center border-2 border-black px-4 py-2 text-sm font-black uppercase shadow-brutal ${
                                                member.full_name ? 'bg-brutal-green text-black' : 'bg-gray-300 text-black'
                                            }`}>
                                                {member.full_name ? 'ACTIVE' : 'PENDING'}
                                            </span>

                                            {/* 🌟 THE REMOVE DEVELOPER BUTTON */}
                                            {member.role !== 'admin' && (
                                                <button
                                                    onClick={() => handleRemoveDeveloper(member.id, member.email)}
                                                    className="btn-brutal bg-white text-black px-4 py-2"
                                                >
                                                    REMOVE
                                                </button>
                                            )}
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