"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function IntegrationsPage() {
    const router = useRouter();
    
    // 1. Dynamic Basecamp Boards
    const [basecampBoards, setBasecampBoards] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // 🌟 Basecamp Auth State (Updated for OAuth Flow)
    const [basecampCredentials, setBasecampCredentials] = useState({
        accountId: '',
        clientId: '',
        clientSecret: ''
    });
    const [isBasecampConnected, setIsBasecampConnected] = useState(false);
    const [isSavingBasecamp, setIsSavingBasecamp] = useState(false);

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

    // GitHub State
    const [githubPat, setGithubPat] = useState('');
    const [isGithubConnected, setIsGithubConnected] = useState(false);
    const [isSavingGithub, setIsSavingGithub] = useState(false);

    // 4. Fetch dynamic data & check integration statuses when the page loads
    useEffect(() => {
        const fetchAllData = async () => {
            try {
                // Fetch Basecamp Boards
                const resBc = await fetch('https://tron-v3.onrender.com/api/admin/basecamp-boards');
                if (resBc.ok) {
                    const dataBc = await resBc.json();
                    if (dataBc.boards) setBasecampBoards(dataBc.boards);
                }

                // Check Discord Status
                const resDisc = await fetch('https://tron-v3.onrender.com/api/admin/discord-status');
                if (resDisc.ok) {
                    const dataDisc = await resDisc.json();
                    setConnected(prev => ({ ...prev, discord: dataDisc.isConnected }));
                }

                // Check GitHub Status
                const ghRes = await axios.get('https://tron-v3.onrender.com/api/admin/github-status');
                if (ghRes.data.isConnected) setIsGithubConnected(true);

                // Check Basecamp Status
                const bcRes = await axios.get('https://tron-v3.onrender.com/api/admin/basecamp-status');
                if (bcRes.data.isConnected) setIsBasecampConnected(true);

            } catch (error) {
                console.error("Failed to fetch integration data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, []);

    // 5. Connection Handler for Communication Tools
    const handleConnect = async (provider) => {
        if (provider === 'discord') {
            const token = tokens.discord;
            if (!token) return alert("Please enter a Discord Bot Token.");

            try {
                const response = await fetch('https://tron-v3.onrender.com/api/admin/discord-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token })
                });

                if (response.ok) {
                    alert("Discord Connected Successfully!");
                    setTokens({ ...tokens, discord: '' });
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

            {/* --- VERSION CONTROL SECTION --- */}
            <div className="mb-10">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Version Control</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* GitHub Inline Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <span className="text-3xl">🐙</span>
                                <h3 className="text-xl font-bold text-gray-800">GitHub</h3>
                            </div>
                            {isGithubConnected && (
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Active</span>
                            )}
                        </div>

                        <p className="text-gray-500 text-sm mb-6 flex-grow">
                            Connect your Personal Access Token (PAT) to grant TRON permission to create branches, read PRs, and perform automated AI code reviews.
                        </p>

                        {/* Dynamic Bottom Section: Input Field OR Connected Status */}
                        {isGithubConnected ? (
                            <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                                <span className="text-sm font-bold text-gray-700">Token Connected</span>
                                <button 
                                    onClick={async () => {
                                        try {
                                            await axios.delete('https://tron-v3.onrender.com/api/admin/delete-integration/github');
                                            setIsGithubConnected(false);
                                            setGithubPat('');
                                        } catch (error) {
                                            console.error("Failed to disconnect GitHub", error);
                                            alert("Failed to disconnect. Please check the server logs.");
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="mt-auto border-t border-gray-100 pt-4">
                                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">
                                    Personal Access Token
                                </label>
                                <input 
                                    type="password" 
                                    value={githubPat}
                                    onChange={(e) => setGithubPat(e.target.value)}
                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                                    className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:teal-500 focus:border-teal-500 outline-none transition-all font-mono text-sm mb-3"
                                />
                                <button 
                                    onClick={async () => {
                                        setIsSavingGithub(true);
                                        try {
                                            await axios.post('https://tron-v3.onrender.com/api/admin/save-integration', { 
                                                provider: 'github', 
                                                token: githubPat 
                                            });
                                            setIsGithubConnected(true);
                                        } catch (error) {
                                            console.error("Failed to save GitHub token", error);
                                        } finally {
                                            setIsSavingGithub(false);
                                        }
                                    }}
                                    disabled={!githubPat || isSavingGithub}
                                    className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center shadow-sm"
                                >
                                    {isSavingGithub ? 'Connecting...' : 'Connect GitHub'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* --- PROJECT MANAGEMENT SECTION --- */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Project Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Basecamp Interactive Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <span className="text-3xl">⛺</span>
                                <h3 className="text-xl font-bold text-gray-800">Basecamp</h3>
                            </div>
                            {isBasecampConnected && (
                                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Active</span>
                            )}
                        </div>

                        <p className="text-gray-500 text-sm mb-6 flex-grow">
                            Authorize TRON to sync tasks, auto-assign developers, and manage column states automatically.
                        </p>

                        {/* Dynamic Bottom Section */}
                        {isBasecampConnected ? (
                            <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                                <span className="text-sm font-bold text-gray-700">Account Connected</span>
                                <button 
                                    onClick={async () => {
                                        try {
                                            await axios.delete('https://tron-v3.onrender.com/api/admin/delete-integration/basecamp');
                                            setIsBasecampConnected(false);
                                            setBasecampCredentials({ accountId: '', clientId: '', clientSecret: '' });
                                        } catch (error) {
                                            console.error("Failed to disconnect Basecamp", error);
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="mt-auto border-t border-gray-100 pt-4 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Account ID</label>
                                    <input 
                                        type="text" 
                                        value={basecampCredentials.accountId}
                                        onChange={(e) => setBasecampCredentials({...basecampCredentials, accountId: e.target.value})}
                                        placeholder="e.g. 9999999"
                                        className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Client ID</label>
                                    <input 
                                        type="password" 
                                        value={basecampCredentials.clientId}
                                        onChange={(e) => setBasecampCredentials({...basecampCredentials, clientId: e.target.value})}
                                        placeholder="Paste Client ID..."
                                        className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Client Secret</label>
                                    <input 
                                        type="password" 
                                        value={basecampCredentials.clientSecret}
                                        onChange={(e) => setBasecampCredentials({...basecampCredentials, clientSecret: e.target.value})}
                                        placeholder="Paste Client Secret..."
                                        className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs mb-2"
                                    />
                                </div>
                                <button 
                                    onClick={async () => {
                                        setIsSavingBasecamp(true);
                                        try {
                                            const res = await axios.post('https://tron-v3.onrender.com/api/auth/basecamp/init', basecampCredentials);
                                            if (res.data.redirectUrl) {
                                                window.location.href = res.data.redirectUrl;
                                            }
                                        } catch (error) {
                                            console.error("Failed to start Basecamp auth", error);
                                            setIsSavingBasecamp(false);
                                        }
                                    }}
                                    disabled={!basecampCredentials.accountId || !basecampCredentials.clientId || !basecampCredentials.clientSecret || isSavingBasecamp}
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center shadow-sm"
                                >
                                    {isSavingBasecamp ? 'Preparing Dance...' : 'Login with Basecamp'}
                                </button>
                            </div>
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