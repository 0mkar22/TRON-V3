"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export default function SetPasswordPage() {
    // 🌟 NEW: Added Full Name state
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [sessionReady, setSessionReady] = useState(false); 

    const supabase = createClient();

    useEffect(() => {
        const establishSession = async () => {
            const hash = window.location.hash;
            if (hash && hash.includes('access_token')) {
                const params = new URLSearchParams(hash.substring(1));
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken && refreshToken) {
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });
                    if (!error) {
                        setSessionReady(true);
                        return;
                    }
                }
            }
            const { data: { session } } = await supabase.auth.getSession();
            if (session) setSessionReady(true);
        };

        establishSession();
    }, [supabase.auth]);

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        if (!fullName.trim()) {
            setStatus({ type: 'error', message: "Please enter your full name." });
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: "Passwords do not match." });
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', message: "Password must be at least 6 characters." });
            setLoading(false);
            return;
        }

        if (!sessionReady) {
            setStatus({ type: 'error', message: "Authenticating invite link... please wait." });
            setLoading(false);
            return;
        }

        try {
            // 1. Update the core Auth engine with the new password AND their metadata name
            const { data: authData, error: authError } = await supabase.auth.updateUser({ 
                password: password,
                data: { full_name: fullName.trim() }
            });
            
            if (authError) throw authError;

            // 2. Sync the name to your public Users table so the Team Roster updates instantly!
            if (authData?.user?.id) {
                const { error: dbError } = await supabase
                    .from('users')
                    .update({ full_name: fullName.trim() })
                    .eq('id', authData.user.id);
                    
                if (dbError) {
                    console.error("Failed to sync public user table:", dbError);
                    // We don't throw this error because their password STILL successfully set
                }
            }

            setIsSuccess(true);
        } catch (error) {
            setStatus({ type: 'error', message: error.message || "Link expired or invalid." });
        } finally {
            setLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
                <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
                    <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6">
                        <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">Account Activated</h2>
                    <p className="text-gray-500 mb-8 text-lg">Welcome aboard, {fullName.split(' ')[0]}! Your access is secure.</p>
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-left">
                        <h3 className="text-sm font-bold tracking-widest text-indigo-600 uppercase mb-4">Final Setup Steps</h3>
                        <div className="space-y-4">
                            <div className="flex">
                                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">1</div>
                                <p className="ml-4 text-gray-600 mt-1">Open <span className="font-semibold text-gray-900">VS Code</span>.</p>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">2</div>
                                <p className="ml-4 text-gray-600 mt-1">Press <kbd className="bg-gray-100 border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-800">F1</kbd> to open the command palette.</p>
                            </div>
                            <div className="flex">
                                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm">3</div>
                                <p className="ml-4 text-gray-600 mt-1">Type <span className="font-mono text-sm bg-gray-100 px-1 py-0.5 rounded">T.R.O.N: Sign In</span>.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex font-sans">
            {/* Left Column - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">T</div>
                        <span className="text-2xl font-bold tracking-wider">T.R.O.N. V3</span>
                    </div>
                </div>
                
                <div className="relative z-10 max-w-lg">
                    <h1 className="text-4xl font-bold leading-tight mb-6">Welcome to the central automation engine.</h1>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Secure your account to access your automated Git workflows, synced Basecamp tickets, and team integrations directly from your editor.
                    </p>
                </div>
                
                <div className="relative z-10 text-sm text-slate-500">
                    © 2026 T.R.O.N. Enterprise. All rights reserved.
                </div>
            </div>

            {/* Right Column - Form */}
            <div className="flex w-full lg:w-1/2 flex-col justify-center items-center p-8 sm:p-12 lg:p-24">
                <div className="w-full max-w-md">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">T</div>
                        <span className="text-xl font-bold tracking-wider text-gray-900">T.R.O.N. V3</span>
                    </div>

                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Activate Account</h2>
                    <p className="mt-2 text-gray-500 text-base mb-8">
                        Set your name and a secure password to complete your onboarding.
                    </p>

                    <form className="space-y-6" onSubmit={handleSetPassword}>
                        
                        {/* 🌟 NEW: Full Name Field */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                            <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Alan Bradley"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                            />
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    ) : (
                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                            />
                        </div>

                        {status.message && (
                            <div className={`p-4 rounded-xl text-sm flex items-start ${
                                status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-blue-50 text-blue-800 border border-blue-100'
                            }`}>
                                <span className="font-medium">{status.message}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !password || !confirmPassword || !fullName || !sessionReady}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-all duration-200"
                        >
                            {!sessionReady ? (
                                'Authenticating Link...'
                            ) : loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Activating Account...
                                </>
                            ) : (
                                'Set Password & Activate'
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}