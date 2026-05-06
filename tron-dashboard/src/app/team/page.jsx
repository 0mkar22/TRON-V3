"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import axios from 'axios';

export default function TeamManagementPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    
    // Initialize Supabase client to grab your secure token
    const supabase = createClient();

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        try {
            // 1. Get the current Admin's secure session token
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session) {
                throw new Error("You must be logged in to invite developers.");
            }

            // 2. Hit our newly created backend route!
            // Note: Change to localhost:3000 if testing locally before deploying
            const API_BASE_URL = 'https://tron-v3.onrender.com'; 
            
            const response = await axios.post(
                `${API_BASE_URL}/api/admin/invite-developer`,
                { email: email.trim() },
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            );

            setStatus({ type: 'success', message: response.data.message });
            setEmail(''); // Clear the input field
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
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Team Management</h1>
                <p className="text-gray-500 mt-2">Invite developers to your TRON organization.</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                        <span className="mr-2">✉️</span> Send Invitation
                    </h2>
                </div>
                
                <div className="p-6">
                    <form onSubmit={handleInvite} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Developer Email Address
                            </label>
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="developer@company.com"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        {status.message && (
                            <div className={`p-4 rounded-md text-sm font-bold ${
                                status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
                            }`}>
                                {status.message}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading || !email}
                            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 mt-2"
                        >
                            {loading ? 'Sending Invite...' : 'Invite Developer'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}