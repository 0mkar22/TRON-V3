import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

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

    // 🌟 SERVER ACTION: Secure Proxy
    const saveIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        let redirectUrl = null;

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id').eq('id', user.id).single();
        const secureOrgId = userData?.org_id;

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
                    const errorText = await res.text();
                    console.error(`🚨 Render Backend Error (${res.status}):`, errorText);
                }
            }
        } catch (error) {
            console.error(`Failed to sync ${provider} with Render engine:`, error);
        }

        revalidatePath('/integrations');
        if (redirectUrl) redirect(redirectUrl);
    };

    // 🌟 SERVER ACTION: Secure Proxy Delete
    const deleteIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id').eq('id', user.id).single();
        const secureOrgId = userData?.org_id;

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
            console.error(`Failed to disconnect ${provider}:`, e);
        }

        revalidatePath('/integrations');
    };

    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-8 font-sans">
            {/* Header Section */}
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Integrations</h1>
                <p className="text-gray-500 mt-2 text-lg">Connect your tools to enable TRON&apos;s automated workflows.</p>
            </div>

            <div className="space-y-12">
                {/* --- VERSION CONTROL --- */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="bg-gray-100 text-gray-600 h-8 w-8 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                        Version Control
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${github ? 'border-gray-200 ring-2 ring-gray-900' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">🐙</span>
                                    <h3 className="text-lg font-bold text-gray-900">GitHub</h3>
                                </div>
                                {github && <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <p className="text-gray-500 text-sm mb-6 flex-grow">
                                    Connect your Personal Access Token (PAT) to grant TRON permission to read PRs and perform automated AI code reviews.
                                </p>
                                {github ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <input type="hidden" name="provider" value="github" />
                                        <span className="text-sm font-semibold text-gray-700">Token Connected</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4">
                                        <input type="hidden" name="provider" value="github" />
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Access Token</label>
                                            <input name="token" type="password" required placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all font-mono text-sm" />
                                        </div>
                                        <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Connect GitHub
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
                
                {/* --- PROJECT MANAGEMENT --- */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="bg-gray-100 text-gray-600 h-8 w-8 rounded-lg flex items-center justify-center mr-3 text-sm">2</span>
                        Project Management
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${basecamp ? 'border-indigo-200 ring-2 ring-indigo-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">⛺</span>
                                    <h3 className="text-lg font-bold text-gray-900">Basecamp</h3>
                                </div>
                                {basecamp && <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <p className="text-gray-500 text-sm mb-6 flex-grow">
                                    Authorize TRON to sync tasks, auto-assign developers, and manage column states.
                                </p>
                                {basecamp ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                        <input type="hidden" name="provider" value="basecamp" />
                                        <span className="text-sm font-semibold text-indigo-900">Account Linked</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4">
                                        <input type="hidden" name="provider" value="basecamp" />
                                        <div className="space-y-3">
                                            <input name="accountId" type="text" required placeholder="Account ID" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm" />
                                            <input name="clientId" type="password" required placeholder="Client ID" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm" />
                                            <input name="clientSecret" type="password" required placeholder="Client Secret" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm" />
                                        </div>
                                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Login with Basecamp
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Jira Coming Soon */}
                         <div className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 p-6 flex flex-col justify-center items-center text-center opacity-70">
                            <span className="text-3xl grayscale mb-3">📊</span>
                            <h3 className="text-lg font-bold text-gray-500 mb-1">Jira</h3>
                            <p className="text-sm text-gray-400 mb-4">Enterprise issue tracking.</p>
                            <span className="bg-gray-200 text-gray-500 text-xs font-bold px-3 py-1 rounded-full">Coming Soon</span>
                        </div>
                    </div>
                </section>

                {/* --- COMMUNICATION CHANNELS --- */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="bg-gray-100 text-gray-600 h-8 w-8 rounded-lg flex items-center justify-center mr-3 text-sm">3</span>
                        Communication
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${discord ? 'border-blue-200 ring-2 ring-blue-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">🎮</span>
                                    <h3 className="text-lg font-bold text-gray-900">Discord</h3>
                                </div>
                                {discord && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <p className="text-sm text-gray-500 mb-6 flex-grow">Broadcast AI executive summaries directly to your server.</p>
                                {discord ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <input type="hidden" name="provider" value="discord" />
                                        <span className="text-sm font-semibold text-blue-900">Bot Connected</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4">
                                        <input type="hidden" name="provider" value="discord" />
                                        <div>
                                            <input name="token" type="password" required placeholder="Bot Token" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Connect Discord
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${slack ? 'border-teal-200 ring-2 ring-teal-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">💬</span>
                                    <h3 className="text-lg font-bold text-gray-900">Slack</h3>
                                </div>
                                {slack && <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <p className="text-sm text-gray-500 mb-6 flex-grow">Send automated code reviews to your Slack workspace.</p>
                                {slack ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-teal-50 p-4 rounded-xl border border-teal-100">
                                        <input type="hidden" name="provider" value="slack" />
                                        <span className="text-sm font-semibold text-teal-900">Bot Connected</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4">
                                        <input type="hidden" name="provider" value="slack" />
                                        <div>
                                            <input name="token" type="password" required placeholder="Webhook URL" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm" />
                                        </div>
                                        <button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Connect Slack
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}