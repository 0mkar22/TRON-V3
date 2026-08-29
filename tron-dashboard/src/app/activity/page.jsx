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
                    const { data: userData } = await supabase.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
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
                const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/system-status?orgId=${orgIdRef.current}`);
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
        <div className="max-w-7xl mx-auto p-8 font-sans">
            <div className="mb-8 border-b-8 border-black pb-4">
                <h1 className="text-5xl font-black uppercase text-black tracking-tight">Mission Control</h1>
                <p className="font-mono text-xl font-bold text-black mt-2">Real-time monitoring of TRON background workers.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Active Queue Panel */}
                <div className="bg-brutal-orange border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="flex justify-between items-center p-6 border-b-4 border-black bg-white">
                        <h2 className="text-3xl font-black uppercase text-black">Active Queue</h2>
                        <span className="bg-black text-white px-4 py-2 font-mono font-bold text-xl shadow-brutal">
                            {status.queueCount} PENDING
                        </span>
                    </div>
                    
                    <div className="p-6 bg-white flex-grow space-y-4">
                        {status.queue.length === 0 ? (
                            <div className="text-center py-10 border-4 border-black border-dashed">
                                <p className="font-mono font-bold text-2xl uppercase text-black">QUEUE EMPTY</p>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {status.queue.map((job, idx) => (
                                    <li key={idx} className="bg-white border-4 border-black p-4 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all">
                                        <div className="flex justify-between mb-2 border-b-2 border-black pb-2">
                                            <span className="font-black text-black uppercase text-lg">EVENT: {job.eventType}</span>
                                            <span className="text-black font-mono font-bold bg-brutal-green px-2 border-2 border-black">ID: {job.deliveryId?.substring(0,8) || 'local'}</span>
                                        </div>
                                        <span className="text-black font-mono font-bold text-lg">{job.payload?.repository?.full_name || 'System Task'}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* AI Reviews Panel */}
                <div className="bg-brutal-blue border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="flex justify-between items-center p-6 border-b-4 border-black bg-white">
                        <h2 className="text-3xl font-black uppercase text-black">AI Review Cache</h2>
                        <span className="bg-black text-white px-4 py-2 font-mono font-bold text-xl shadow-brutal">
                            {status.reviewCount} STORED
                        </span>
                    </div>
                    
                    <div className="p-6 bg-white flex-grow space-y-4">
                        {status.reviews.length === 0 ? (
                            <div className="text-center py-10 border-4 border-black border-dashed">
                                <p className="font-mono font-bold text-2xl uppercase text-black">NO REVIEWS CACHED</p>
                            </div>
                        ) : (
                            <ul className="space-y-4">
                                {status.reviews.map((review, idx) => (
                                    <li 
                                        key={idx} 
                                        onClick={() => setSelectedReview(review)}
                                        className="bg-white border-4 border-black p-4 shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg transition-all cursor-pointer flex justify-between items-center group"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <span className="font-black text-black text-xl uppercase">
                                                TASK: <span className="font-mono bg-brutal-pink px-2 border-2 border-black">{review.taskId}</span>
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-black border-2 border-black px-2 py-1 bg-brutal-green shadow-brutal">
                                                VIEW
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            {/* The AI Review Modal */}
            {selectedReview && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border-4 border-black shadow-brutal-lg max-w-3xl w-full max-h-[90vh] flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b-4 border-black bg-brutal-pink flex justify-between items-center">
                            <h3 className="text-3xl font-black text-black uppercase flex items-center gap-4">
                                AI CODE REVIEW
                                <span className="font-mono bg-white text-black px-3 py-1 border-4 border-black text-xl shadow-brutal">
                                    ID: {selectedReview.taskId}
                                </span>
                            </h3>
                            <button 
                                onClick={() => setSelectedReview(null)}
                                className="text-black hover:text-white transition-colors bg-white hover:bg-black border-4 border-black w-12 h-12 flex items-center justify-center font-black text-2xl shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1"
                            >
                                X
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-grow bg-white">
                            <div className="border-4 border-black p-4 bg-brutal-bg shadow-brutal">
                                <h4 className="font-black text-black uppercase text-xl mb-4 border-b-4 border-black pb-2">PAYLOAD DATA</h4>
                                <pre className="whitespace-pre-wrap text-lg text-black font-mono overflow-x-auto">
                                    {selectedReview.details?.review || JSON.stringify(selectedReview.details, null, 2)}
                                </pre>
                            </div>
                        </div>
                        
                        {/* Modal Footer */}
                        <div className="p-6 border-t-4 border-black bg-white flex justify-end">
                            <button 
                                onClick={() => setSelectedReview(null)}
                                className="btn-brutal bg-black text-white px-8 py-4 text-xl"
                            >
                                CLOSE WINDOW
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}