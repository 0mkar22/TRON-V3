"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import axios from 'axios';

export default function TeamManagementPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    
    // 🌟 State to hold our team roster
    const [teamMembers, setTeamMembers] = useState([]);
    const [loadingTeam, setLoadingTeam] = useState(true);
    
    const supabase = createClient();

    // 🌟 1. DEFINE THE FUNCTION FIRST (Fixes the red squiggly!)
    const fetchTeamMembers = useCallback(async () => {
        await Promise.resolve();
        setLoadingTeam(true);
        try {
            // 1. Get the currently logged-in Admin
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 2. Find out which Organization they belong to
            const { data: currentUserData } = await supabase
                .from('users')
                .select('org_id')
                .eq('id', user.id)
                .single();

            // 3. Fetch EVERYONE who shares that Organization ID
            if (currentUserData?.org_id) {
                const { data: members, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('org_id', currentUserData.org_id)
                    .order('created_at', { ascending: true }); // Oldest first (Admins at top)
                
                if (error) throw error;
                setTeamMembers(members || []);
            }
        } catch (error) {
            console.error("Error fetching team roster:", error);
        } finally {
            setLoadingTeam(false);
        }
    }, [supabase]);

    // 🌟 2. CALL IT SECOND in the useEffect
    useEffect(() => {
        Promise.resolve().then(fetchTeamMembers);
    }, [fetchTeamMembers]);

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error("You must be logged in to invite developers.");

            // Remember to change this back to your Render URL for production!
            const API_BASE_URL = 'http://localhost:5000'; 
            
            const response = await axios.post(
                `${API_BASE_URL}/api/admin/invite-developer`,
                { email: email.trim() },
                { headers: { Authorization: `Bearer ${session.access_token}` } }
            );

            setStatus({ type: 'success', message: response.data.message });
            setEmail('');
            
            // Refresh the roster to instantly show the newly invited developer!
            fetchTeamMembers();

        } catch (error) {
            setStatus({ 
                type: 'error', 
                message: error.response?.data?.error || error.message || "Failed to send invite." 
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-8 font-sans">
            {/* Header Section */}
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Team Management</h1>
                <p className="text-gray-500 mt-2 text-lg">Build your engineering team and configure their access.</p>
            </div>

            {/* 🌟 CARD 1: Invite Form */}
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
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Email Address
                            </label>
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

            {/* 🌟 CARD 2: Active Team Roster */}
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
                    {loadingTeam ? (
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
                                        
                                        {/* Avatar and Name */}
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

                                        {/* Status Badges */}
                                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {member.role === 'admin' ? 'Admin' : 'Developer'}
                                            </span>
                                            
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                member.full_name ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {/* If they have a name, they've finished onboarding! */}
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