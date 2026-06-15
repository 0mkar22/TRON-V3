"use client";

import { useState } from 'react';
import { assignDeveloperAction } from './actions';

export default function AssignmentForm({ developers = [], workflows = [] }) {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    // Filter to only show developers (exclude admins from needing assignment)
    const availableDevs = developers.filter(dev => dev.role !== 'admin');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        const formData = new FormData(e.target);
        
        try {
            const result = await assignDeveloperAction(formData);
            setStatus({ 
                type: result.success ? 'success' : 'error', 
                message: result.message 
            });
            if (result.success) {
                e.target.reset(); 
            }
        } catch (err) {
            setStatus({ type: 'error', message: "Failed to assign developer." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-8">
            <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Assign to Workflow</h2>
                    <p className="text-sm text-gray-500 mt-1">Grant a developer access to a specific repository and PM board.</p>
                </div>
                <div className="hidden sm:flex h-12 w-12 bg-purple-50 rounded-full items-center justify-center text-purple-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </div>
            </div>

            <div className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Developer Dropdown */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Developer</label>
                            <select 
                                name="userId" 
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            >
                                <option value="" disabled selected>-- Choose a team member --</option>
                                {availableDevs.map(dev => (
                                    <option key={dev.id} value={dev.id}>{dev.full_name || dev.email}</option>
                                ))}
                            </select>
                        </div>

                        {/* Workflow Dropdown */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Target Workflow</label>
                            <select 
                                name="repositoryId" 
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            >
                                <option value="" disabled selected>-- Choose a mapped repository --</option>
                                {workflows.map(wf => (
                                    <option key={wf.id} value={wf.id}>
                                        {wf.repo_name} ({wf.pm_provider})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {status.message && (
                        <div className={`p-4 rounded-xl text-sm flex items-start ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                            <span className="font-medium">{status.message}</span>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading || availableDevs.length === 0 || workflows.length === 0}
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-all duration-200 disabled:opacity-60"
                    >
                        {loading ? 'Assigning...' : 'Grant Access'}
                    </button>
                </form>
            </div>
        </div>
    );
}