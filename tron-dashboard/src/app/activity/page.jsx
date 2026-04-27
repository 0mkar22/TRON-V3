"use client";
import { useEffect, useState } from 'react';

export default function ActivityDashboard() {
    const [status, setStatus] = useState({ queue: [], reviews: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 🌟 Move the function INSIDE the useEffect to satisfy the React linter!
        const fetchStatus = async () => {
            try {
                // ⚠️ Update this to your Render URL if you are deploying to production!
                const res = await fetch('https://tron-v3-engine.onrender.com/api/admin/system-status');
                const data = await res.json();
                setStatus(data);
                setLoading(false);
            } catch (error) {
                console.error('Failed to fetch status', error);
                setLoading(false);
            }
        };

        // Call it immediately once...
        fetchStatus();
        
        // ...then set it to run every 5 seconds
        const interval = setInterval(fetchStatus, 5000);
        
        // Cleanup the interval when you navigate away from the page
        return () => clearInterval(interval);
    }, []); // <-- Now the dependency array is perfectly clean!

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh] text-gray-600">
                <span className="text-xl animate-pulse font-semibold">Loading Mission Control...</span>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
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
                                <li key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm flex justify-between items-center hover:shadow-md transition-shadow">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-xl">📄</span>
                                        <span className="font-medium text-gray-700">Task ID: <span className="font-mono font-bold text-gray-900">{review.taskId}</span></span>
                                    </div>
                                    <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-md font-semibold">
                                        Available in VS Code
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}