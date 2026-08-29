"use client";

import { useState } from 'react';
import { assignDeveloperAction } from './actions';

export default function AssignmentForm({ developers = [], workflows = [], onSuccess }) {
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
                if (onSuccess) onSuccess(); 
            }
        } catch (err) {
            setStatus({ type: 'error', message: "Failed to assign developer." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col mb-8">
            <div className="p-6 border-b-4 border-black bg-brutal-orange flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black uppercase text-black">Assign to Workflow</h2>
                    <p className="font-mono font-bold text-black mt-1">Grant a developer access to a specific repository and PM board.</p>
                </div>
                <div className="hidden sm:flex h-16 w-16 bg-white border-4 border-black items-center justify-center text-black shadow-brutal">
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
                            <label className="block font-black text-xl mb-2 uppercase text-black">Select Developer</label>
                            <select 
                                name="userId" 
                                required
                                className="input-brutal text-black"
                            >
                                <option value="" disabled selected>-- Choose a team member --</option>
                                {availableDevs.map(dev => (
                                    <option key={dev.id} value={dev.id}>{dev.full_name || dev.email}</option>
                                ))}
                            </select>
                        </div>

                        {/* Workflow Dropdown */}
                        <div>
                            <label className="block font-black text-xl mb-2 uppercase text-black">Select Target Workflow</label>
                            <select 
                                name="repositoryId" 
                                required
                                className="input-brutal text-black"
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
                        <div className={`mb-6 p-4 border-4 border-black font-black uppercase text-center shadow-brutal text-black ${status.type === 'success' ? 'bg-brutal-green' : 'bg-brutal-pink'}`}>
                            <span className="font-mono font-bold">{status.message}</span>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading || availableDevs.length === 0 || workflows.length === 0}
                        className="btn-brutal bg-brutal-blue text-black px-6 py-4 text-xl mt-4 disabled:opacity-50"
                    >
                        {loading ? 'Assigning...' : 'Grant Access'}
                    </button>
                </form>
            </div>
        </div>
    );
}