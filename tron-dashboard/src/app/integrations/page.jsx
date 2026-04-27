"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IntegrationsPage() {
    const router = useRouter();
    
    // 1. Dynamic Basecamp Boards
    const [basecampBoards, setBasecampBoards] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 2. Connection Statuses
    const [connected, setConnected] = useState({
        slack: false,
        discord: false
    });

    // 3. Tokens State
    const [tokens, setTokens] = useState({
        slack: '',
        discord: ''
    });

    // 4. Fetch dynamic data when the page loads
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Basecamp Boards
                const resBc = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-boards');
                if (resBc.ok) {
                    const dataBc = await resBc.json();
                    if (dataBc.boards) setBasecampBoards(dataBc.boards);
                }

                // 🌟 NEW: Fetch Discord Status
                const resDisc = await fetch('https://tron-v3.onrender.com/api/admin/discord-status');
                if (resDisc.ok) {
                    const dataDisc = await resDisc.json();
                    setConnected(prev => ({ ...prev, discord: dataDisc.isConnected }));
                }
            } catch (error) {
                console.error("Failed to fetch integration data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

   // 5. Connection Handler for Communication Tools
    const handleConnect = async (provider) => {
        if (provider === 'discord') {
            const token = tokens.discord;
            if (!token) return alert("Please enter a Discord Bot Token.");

            try {
                // ⚠️ Update to your Render URL if testing in production!
                // Make sure to use your actual Org UUID from your database screenshot
                const response = await fetch('https://tron-v3.onrender.com/api/admin/discord-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                    token: token 
                    })
                });

                if (response.ok) {
                    alert("Discord Connected Successfully!");
                    setTokens({ ...tokens, discord: '' }); // Clear the input field
                } else {
                    alert("Failed to connect Discord.");
                }
            } catch (error) {
                console.error("Connection error:", error);
            }
        }
    };

    const handleDisconnect = async (provider) => {
        if (provider === 'discord') {
            try {
                const response = await fetch('https://tron-v3.onrender.com/api/admin/discord-token', {
                    method: 'DELETE'
                });
                if (response.ok) {
                    setConnected({ ...connected, discord: false });
                }
            } catch (error) {
                console.error("Failed to disconnect:", error);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            {/* Header Section */}
            <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-gray-900">🔌 Integrations</h1>
                <p className="text-gray-500 mt-2 text-lg">Connect your Project Management tools and Communication channels to enable TRON&apos;s automated workflows.</p>
            </div>

            {/* --- PROJECT MANAGEMENT SECTION --- */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Project Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Basecamp Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                        {basecampBoards.length > 0 && <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>}
                        
                        <div className="flex justify-between items-center mb-4 mt-1">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2 text-2xl">🏕️</span> Basecamp
                            </h3>
                            {basecampBoards.length > 0 && (
                                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                    {basecampBoards.length} Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-6 flex-grow">Sync tasks, auto-assign developers, and manage column states automatically.</p>
                        
                        {isLoading ? (
                            <div className="text-center py-4 text-gray-400 text-sm animate-pulse">Loading boards...</div>
                        ) : basecampBoards.length > 0 ? (
                            <div className="space-y-3">
                                {/* Loop through all connected boards */}
                                {basecampBoards.map((board) => (
                                    <div key={board.id} className="bg-gray-50 rounded border border-gray-200 p-3 flex justify-between items-center hover:border-blue-300 transition-colors">
                                        <div>
                                            <span className="block text-sm font-bold text-gray-800">{board.name}</span>
                                            <span className="text-xs text-gray-500 font-mono">ID: {board.id}</span>
                                        </div>
                                        <button 
                                            onClick={() => setBasecampBoards(boards => boards.filter(b => b.id !== board.id))}
                                            className="text-xs text-red-500 font-bold hover:text-red-700 hover:underline px-2 py-1"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                ))}
                                
                                {/* Add Another Board Button (Redirects to Repositories) */}
                                <button 
                                    onClick={() => router.push('/repositories')}
                                    className="w-full mt-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded border border-blue-200 transition-colors shadow-sm text-sm"
                                >
                                    Map to Repository ➔
                                </button>
                            </div>
                        ) : (
                            /* Empty State Connect Button (Redirects to Repositories) */
                            <button 
                                onClick={() => router.push('/repositories')}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors shadow-sm mt-auto"
                            >
                                Connect Basecamp
                            </button>
                        )}
                    </div>
                    
                    {/* Jira Card */}
                     <div className="bg-gray-50 p-6 rounded-xl border border-dashed border-gray-300 opacity-70 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-500 flex items-center">
                                <span className="mr-2 text-2xl grayscale">📊</span> Jira
                            </h3>
                            <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">Coming Soon</span>
                        </div>
                        <p className="text-sm text-gray-400 mb-6 flex-grow">Enterprise-grade issue and project tracking for software teams.</p>
                        <button disabled className="w-full bg-gray-200 text-gray-400 font-bold py-2 px-4 rounded cursor-not-allowed mt-auto">
                            Not Available
                        </button>
                    </div>
                </div>
            </div>

            {/* --- COMMUNICATION CHANNELS SECTION --- */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Communication Channels</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Discord Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow relative overflow-hidden flex flex-col">
                        {connected.discord && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>}
                        
                        <div className="flex justify-between items-center mb-4 mt-1">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2 text-2xl">🎮</span> Discord
                            </h3>
                            {connected.discord && (
                                <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                    Active
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mb-5 flex-grow">Broadcast AI executive summaries and PR alerts directly to your server.</p>
                        
                        {connected.discord ? (
                            /* 🌟 ACTIVE STATE: Show Disconnect Button */
                            <div className="bg-gray-50 rounded border border-gray-200 p-3 flex justify-between items-center mt-auto">
                                <span className="text-xs text-gray-500 font-bold">Bot Connected</span>
                                <button 
                                    onClick={() => handleDisconnect('discord')}
                                    className="text-xs text-red-500 font-bold hover:text-red-700 hover:underline px-2 py-1"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            /* 🌟 INACTIVE STATE: Show Token Input */
                            <div className="space-y-4 border-t border-gray-100 pt-4 mt-auto">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Bot Token</label>
                                    <input 
                                        type="password" 
                                        placeholder="Enter Discord Bot Token" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        value={tokens.discord}
                                        onChange={(e) => setTokens({ ...tokens, discord: e.target.value })}
                                    />
                                </div>
                                <button 
                                    onClick={() => {
                                        handleConnect('discord');
                                        // Optimistically set to connected so the UI flips instantly
                                        setTimeout(() => setConnected({ ...connected, discord: true }), 1000); 
                                    }}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex justify-center items-center"
                                >
                                    Connect Discord
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Slack Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2 text-2xl">💬</span> Slack
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 mb-5 h-10">Send automated code reviews and task updates to your Slack workspace.</p>
                        
                        <div className="space-y-4 border-t border-gray-100 pt-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Bot Token / Webhook</label>
                                <input 
                                    type="password" 
                                    placeholder="Enter Slack Token" 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                                    value={tokens.slack}
                                    onChange={(e) => setTokens({ ...tokens, slack: e.target.value })}
                                />
                            </div>
                            <button 
                                onClick={() => handleConnect('slack')}
                                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex justify-center items-center"
                            >
                                Connect Slack
                            </button>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
}