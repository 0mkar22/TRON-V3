import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';

export default async function IntegrationsPage() {
    // 1. Initialize Supabase & Get User securely on the server
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    // 2. Fetch Organization ID and existing integrations instantly
    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    const orgId = userData?.org_id;

    // Fetch connected tools to update the UI
    const { data: integrations } = await supabase.from('integrations').select('*').eq('org_id', orgId);

    // Helper to check what is currently connected
    const getIntegration = (provider) => integrations?.find(i => i.provider === provider);
    const github = getIntegration('github');
    const basecamp = getIntegration('basecamp');
    const discord = getIntegration('discord');
    const slack = getIntegration('slack');

    // 🌟 SERVER ACTION: Secure Proxy (No direct DB writes!)
    const saveIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        let redirectUrl = null;

        // Get Org ID securely to send to Render
        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id').eq('id', user.id).single();
        const secureOrgId = userData?.org_id;

        // Pass data to Render Engine to handle the Supabase Vault encryption
        try {
            if (provider === 'github') {
                await fetch('https://tron-v3.onrender.com/api/admin/save-integration', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: 'github', token: formData.get('token'), orgId: secureOrgId })
                });
            } 
            else if (provider === 'discord') {
                await fetch('https://tron-v3.onrender.com/api/admin/discord-token', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: formData.get('token'), orgId: secureOrgId })
                });
            }
            else if (provider === 'basecamp') {
                const res = await fetch('https://tron-v3.onrender.com/api/auth/basecamp/init', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: formData.get('accountId'),
                        clientId: formData.get('clientId'),
                        clientSecret: formData.get('clientSecret'),
                        orgId: secureOrgId 
                    })
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.redirectUrl) redirectUrl = data.redirectUrl;
                } else {
                    // 🌟 NEW: Read the exact error message from Render!
                    const errorText = await res.text();
                    console.error(`🚨 Render Backend Error (${res.status}):`, errorText);
                }
            }
        } catch (error) {
            console.error(`Failed to sync ${provider} with Render engine:`, error);
        }

        revalidatePath('/integrations');
        
        // Next.js requires redirect() to be called OUTSIDE of try/catch blocks
        if (redirectUrl) {
            redirect(redirectUrl);
        }
    };

    // 🌟 SERVER ACTION: Secure Proxy Delete
    const deleteIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id').eq('id', user.id).single();
        const secureOrgId = userData?.org_id;

        // Tell Render to delete the vault secret AND the database row
        try {
            if (provider === 'github') await fetch('https://tron-v3.onrender.com/api/admin/delete-integration/github', { 
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: secureOrgId }) 
            });
            if (provider === 'discord') await fetch('https://tron-v3.onrender.com/api/admin/discord-token', { 
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: secureOrgId }) 
            });
            if (provider === 'basecamp') await fetch('https://tron-v3.onrender.com/api/admin/delete-integration/basecamp', { 
                method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: secureOrgId }) 
            });
        } catch (e) {
            console.error(`Failed to disconnect ${provider} from Render engine:`, e);
        }

        revalidatePath('/integrations');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-12 pt-8 px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <div className="mb-8">
                <Link href="/" className="text-sm font-bold text-green-600 hover:text-green-700 mb-2 inline-block">
                    ← Back to Dashboard
                </Link>
                <h1 className="text-3xl font-extrabold text-gray-900">🔌 Integrations</h1>
                <p className="text-gray-500 mt-2 text-lg">Connect your Project Management tools and Communication channels to enable TRON&apos;s automated workflows.</p>
            </div>

            {/* --- VERSION CONTROL SECTION --- */}
            <div className="mb-10">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Version Control</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`bg-white p-6 rounded-xl border ${github ? 'border-blue-400 shadow-md ring-1 ring-blue-400' : 'border-gray-200 shadow-sm'} flex flex-col`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <span className="text-3xl">🐙</span>
                                <h3 className="text-xl font-bold text-gray-800">GitHub</h3>
                            </div>
                            {github && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                        </div>

                        <p className="text-gray-500 text-sm mb-6 flex-grow">
                            Connect your Personal Access Token (PAT) to grant TRON permission to create branches, read PRs, and perform automated AI code reviews.
                        </p>

                        {github ? (
                            <form action={deleteIntegration} className="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                                <input type="hidden" name="provider" value="github" />
                                <span className="text-sm font-bold text-gray-700">Token Connected</span>
                                <button type="submit" className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                            </form>
                        ) : (
                            <form action={saveIntegration} className="mt-auto border-t border-gray-100 pt-4">
                                <input type="hidden" name="provider" value="github" />
                                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Personal Access Token</label>
                                <input name="token" type="password" required placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:teal-500 focus:border-teal-500 outline-none transition-all font-mono text-sm mb-3" />
                                <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center shadow-sm">
                                    Connect GitHub
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            
            {/* --- PROJECT MANAGEMENT SECTION --- */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Project Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className={`bg-white p-6 rounded-xl border ${basecamp ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-gray-200 shadow-sm'} flex flex-col`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-3">
                                <span className="text-3xl">⛺</span>
                                <h3 className="text-xl font-bold text-gray-800">Basecamp</h3>
                            </div>
                            {basecamp && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                        </div>

                        <p className="text-gray-500 text-sm mb-6 flex-grow">
                            Authorize TRON to sync tasks, auto-assign developers, and manage column states automatically.
                        </p>

                        {basecamp ? (
                            <form action={deleteIntegration} className="flex justify-between items-center border-t border-gray-100 pt-4 mt-auto">
                                <input type="hidden" name="provider" value="basecamp" />
                                <span className="text-sm font-bold text-gray-700">Account Connected</span>
                                <button type="submit" className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                            </form>
                        ) : (
                            <form action={saveIntegration} className="mt-auto border-t border-gray-100 pt-4 space-y-3">
                                <input type="hidden" name="provider" value="basecamp" />
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Account ID</label>
                                    <input name="accountId" type="text" required placeholder="e.g. 9999999" className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Client ID</label>
                                    <input name="clientId" type="password" required placeholder="Paste Client ID..." className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1 uppercase tracking-wide">Client Secret</label>
                                    <input name="clientSecret" type="password" required placeholder="Paste Client Secret..." className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-xs mb-2" />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex justify-center items-center shadow-sm">
                                    Login with Basecamp
                                </button>
                            </form>
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
                        <button disabled className="w-full bg-gray-200 text-gray-400 font-bold py-2 px-4 rounded cursor-not-allowed mt-auto">Not Available</button>
                    </div>
                </div>
            </div>

            {/* --- COMMUNICATION CHANNELS SECTION --- */}
            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">Communication Channels</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className={`bg-white p-6 rounded-xl border ${discord ? 'border-indigo-400 shadow-md ring-1 ring-indigo-400' : 'border-gray-200 shadow-sm'} relative overflow-hidden flex flex-col`}>
                        {discord && <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>}
                        
                        <div className="flex justify-between items-center mb-4 mt-1">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2 text-2xl">🎮</span> Discord
                            </h3>
                            {discord && <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">Active</span>}
                        </div>
                        <p className="text-sm text-gray-500 mb-5 flex-grow">Broadcast AI executive summaries and PR alerts directly to your server.</p>
                        
                        {discord ? (
                            <form action={deleteIntegration} className="bg-gray-50 rounded border border-gray-200 p-3 flex justify-between items-center mt-auto">
                                <input type="hidden" name="provider" value="discord" />
                                <span className="text-xs text-gray-500 font-bold">Bot Connected</span>
                                <button type="submit" className="text-xs text-red-500 font-bold hover:text-red-700 hover:underline px-2 py-1">Disconnect</button>
                            </form>
                        ) : (
                            <form action={saveIntegration} className="space-y-4 border-t border-gray-100 pt-4 mt-auto">
                                <input type="hidden" name="provider" value="discord" />
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Bot Token</label>
                                    <input name="token" type="password" required placeholder="Enter Discord Bot Token" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex justify-center items-center">
                                    Connect Discord
                                </button>
                            </form>
                        )}
                    </div>

                    <div className={`bg-white p-6 rounded-xl border ${slack ? 'border-teal-400 shadow-md ring-1 ring-teal-400' : 'border-gray-200 shadow-sm'} flex flex-col`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                <span className="mr-2 text-2xl">💬</span> Slack
                            </h3>
                            {slack && <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2 py-1 rounded-full shadow-sm">Active</span>}
                        </div>
                        <p className="text-sm text-gray-500 mb-5 h-10 flex-grow">Send automated code reviews and task updates to your Slack workspace.</p>
                        
                        {slack ? (
                            <form action={deleteIntegration} className="bg-gray-50 rounded border border-gray-200 p-3 flex justify-between items-center mt-auto">
                                <input type="hidden" name="provider" value="slack" />
                                <span className="text-xs text-gray-500 font-bold">Bot Connected</span>
                                <button type="submit" className="text-xs text-red-500 font-bold hover:text-red-700 hover:underline px-2 py-1">Disconnect</button>
                            </form>
                        ) : (
                            <form action={saveIntegration} className="space-y-4 border-t border-gray-100 pt-4 mt-auto">
                                <input type="hidden" name="provider" value="slack" />
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wide">Bot Token / Webhook</label>
                                    <input name="token" type="password" required placeholder="Enter Slack Token" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all" />
                                </div>
                                <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors shadow-sm flex justify-center items-center">
                                    Connect Slack
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
            
        </div>
    );
}