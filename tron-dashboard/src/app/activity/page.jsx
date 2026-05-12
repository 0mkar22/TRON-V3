"use client";
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client'; // 🌟 NEW: Client-side Supabase import

export default function ActivityDashboard() {
    const [status, setStatus] = useState({ queue: [], reviews: [] });
    const [loading, setLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState(null);
    
    // 🌟 NEW: Use a ref to store orgId securely so the interval can always read it
    const orgIdRef = useRef(null);

    useEffect(() => {
        const supabase = createClient();
        let interval;

        const setupAndFetch = async () => {
            try {
                // 1. Fetch the user's orgId securely on mount
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
                    orgIdRef.current = userData?.org_id;
                }

                // 2. Run the first fetch immediately
                await fetchStatus();

                // 3. Start the polling interval
                interval = setInterval(fetchStatus, 5000);
            } catch (err) {
                console.error("Failed to initialize Mission Control:", err);
                setLoading(false);
            }
        };

        const fetchStatus = async () => {
            // 🌟 FIX 1: If we don't have an orgId yet, do not make the request!
            if (!orgIdRef.current) return;

            try {
                // 🌟 FIX 2: Append the orgId to the backend request URL
                const res = await fetch(`https://tron-v3.onrender.com/api/admin/system-status?orgId=${orgIdRef.current}`);
                const data = await res.json();
                
                if (res.ok) {
                    setStatus({
                        queue: data.queue || [],
                        reviews: data.reviews || [],
                        queueCount: data.queueCount || 0,
                        reviewCount: data.reviewCount || 0
                    });
                } else {
                    console.error("Backend threw an error:", data);
                }
            } catch (error) {
                console.error('Failed to fetch status:', error);
            } finally {
                setLoading(false);
            }
        };

        setupAndFetch();

        // Cleanup the interval when you navigate away from the page
        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-600">
                <span className="text-xl animate-pulse font-semibold">Loading Mission Control...</span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">🚀 Mission Control</h1>
                <p className="text-gray-500 mt-2">Real-time monitoring of your TRON background workers and AI systems.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Active Queue Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            <span className="mr-2">⚡</span> Active Event Queue
                        </h2>
                        <span className="bg-blue-100 text-blue-800 py-1 px-3 rounded-full text-sm font-bold shadow-sm">
                            {status.queueCount} Pending
                        </span>
                    </div>
                    
                    {status.queue.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <p className="text-gray-500 italic">The worker queue is currently empty. All clear!</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {status.queue.map((job, idx) => (
                                <li key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm flex flex-col hover:shadow-md transition-shadow">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold text-blue-600 uppercase tracking-wider text-xs">Event: {job.eventType}</span>
                                        <span className="text-gray-400 text-xs font-mono">ID: {job.deliveryId?.substring(0,8) || 'local'}</span>
                                    </div>
                                    <span className="text-gray-700 font-medium">{job.payload?.repository?.full_name || 'System Task'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* AI Reviews Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                        <h2 className="text-xl font-bold text-gray-800 flex items-center">
                            <span className="mr-2">🧠</span> AI Review Cache
                        </h2>
                        <span className="bg-green-100 text-green-800 py-1 px-3 rounded-full text-sm font-bold shadow-sm">
                            {status.reviewCount} Stored
                        </span>
                    </div>
                    
                    {status.reviews.length === 0 ? (
                        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <p className="text-gray-500 italic">No AI reviews cached in Redis yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {status.reviews.map((review, idx) => (
                                <li 
                                    key={idx} 
                                    onClick={() => setSelectedReview(review)}
                                    className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm flex justify-between items-center hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xl group-hover:text-indigo-500 transition-colors">📄</span>
                                        <span className="font-medium text-gray-700 group-hover:text-indigo-700 transition-colors">
                                            Task ID: <span className="font-mono font-bold text-gray-900">{review.taskId}</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-indigo-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                            View Details
                                        </span>
                                        <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-md font-semibold">
                                            Available in VS Code
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* The AI Review Modal */}
            {selectedReview && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2">🧠</span> AI Code Review
                                <span className="ml-3 text-xs font-mono bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300">
                                    Task: {selectedReview.taskId}
                                </span>
                            </h3>
                            <button 
                                onClick={() => setSelectedReview(null)}
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-grow bg-gray-50">
                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Payload Data</h4>
                                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto">
                                    {selectedReview.details?.review || JSON.stringify(selectedReview.details, null, 2)}
                                </pre>
                            </div>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end">
                            <button 
                                onClick={() => setSelectedReview(null)}
                                className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm"
                            >
                                Close Window
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}