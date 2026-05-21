import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import AutoDismissBanner from '@/components/AutoDismissBanner'; 

// Force Vercel to never cache this route so the auto-setup always fires
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegrationsPage({ searchParams }) {
    // 🌟 Await searchParams for Next.js 15 compatibility
    const params = await searchParams;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    const { data: userData } = await supabase.from('users').select('org_id, role').eq('id', user.id).single();
    
    if (userData?.role !== 'admin') {
        redirect('/');
    }

    const secureOrgId = userData?.org_id;

    // ==========================================
    // 🌟 INVISIBLE GITHUB AUTO-SETUP
    // ==========================================
    if (params?.installation_id && params?.github_setup !== 'success') {
        const supabaseAdmin = createAdminClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        try {
            console.log(`🚀 [AUTO-SETUP] Catching ID: ${params.installation_id} for Org: ${secureOrgId}`);
            
            // 1. Save to Vault
            const { data: newSecretId, error: vaultError } = await supabaseAdmin.rpc('insert_secret', {
                secret_name: `github_app_install_${secureOrgId}_${params.installation_id}`,
                secret_description: `GitHub Installation ID for Org ${secureOrgId}`,
                secret_value: params.installation_id.toString()
            });

            if (vaultError) throw new Error(`Vault Error: ${vaultError.message}`);
            if (!newSecretId) throw new Error("Vault returned no secret ID");

            // 2. Upsert to Integrations Table safely
            const { error: upsertError } = await supabaseAdmin
                .from('integrations')
                .upsert({ 
                    org_id: secureOrgId, 
                    provider: 'github', 
                    secret_id: newSecretId 
                }, { onConflict: 'org_id, provider' });

            if (upsertError) throw new Error(`DB Error: ${upsertError.message}`);

            console.log("✅ [AUTO-SETUP] Success! Purging cache and redirecting.");
        } catch (error) {
            console.error("❌ [AUTO-SETUP] Failed:", error);
            redirect(`/integrations?github_error=${encodeURIComponent(error.message)}`);
        }

        // Clean the URL parameters and show the success banner
        revalidatePath('/integrations');
        redirect('/integrations?github_setup=success');
    }

    // Fetch existing integrations
    const { data: integrations } = await supabase.from('integrations').select('*').eq('org_id', secureOrgId);

    const getIntegration = (provider) => integrations?.find(i => i.provider === provider);
    const github = getIntegration('github');
    const basecamp = getIntegration('basecamp');
    const discord = getIntegration('discord');
    const slack = getIntegration('slack');

    // ==========================================
    // 🌟 SECURE VAULT SERVER ACTIONS (SLACK, DISCORD, BASECAMP)
    // ==========================================
    const saveIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        let redirectUrl = null;

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id, role').eq('id', user.id).single();
        
        if (userData?.role !== 'admin') throw new Error("Unauthorized");
        const actionOrgId = userData?.org_id;

        if (provider === 'basecamp') {
            try {
                const res = await fetch('https://tron-v3.onrender.com/api/auth/basecamp/init', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accountId: formData.get('accountId'),
                        clientId: formData.get('clientId'),
                        clientSecret: formData.get('clientSecret'),
                        orgId: actionOrgId 
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.redirectUrl) redirectUrl = data.redirectUrl;
                }
            } catch (error) {
                console.error(`Failed to init Basecamp via Render:`, error);
            }
        } else {
            const rawToken = formData.get('token');
            const supabaseAdmin = createAdminClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

            try {
                const uniqueSecretName = `TRON ${provider} token for ${actionOrgId} - ${Date.now()}`;
                const { data: newSecretId, error: vaultError } = await supabaseAdmin.rpc('create_integration_secret', {
                    secret_value: rawToken,
                    secret_desc: uniqueSecretName
                });

                if (vaultError) throw vaultError;

                const { data: existingRecords } = await supabaseAdmin.from('integrations').select('id').eq('org_id', actionOrgId).eq('provider', provider);

                if (existingRecords && existingRecords.length > 0) {
                    const { error: updateError } = await supabaseAdmin.from('integrations').update({ secret_id: newSecretId }).eq('id', existingRecords[0].id);
                    if (updateError) throw updateError;

                    if (existingRecords.length > 1) {
                        const duplicateIds = existingRecords.slice(1).map(r => r.id);
                        await supabaseAdmin.from('integrations').delete().in('id', duplicateIds);
                    }
                } else {
                    const { error: insertError } = await supabaseAdmin.from('integrations').insert({ org_id: actionOrgId, provider, secret_id: newSecretId }); 
                    if (insertError) throw insertError;
                }

                if (provider === 'discord') {
                    const { data: botRecords } = await supabaseAdmin.from('integrations').select('id').eq('org_id', actionOrgId).eq('provider', 'discord_bot');
                    if (botRecords && botRecords.length > 0) {
                        await supabaseAdmin.from('integrations').update({ secret_id: newSecretId }).eq('id', botRecords[0].id); 
                        if (botRecords.length > 1) {
                            const botDupes = botRecords.slice(1).map(r => r.id);
                            await supabaseAdmin.from('integrations').delete().in('id', botDupes);
                        }
                    } else {
                        await supabaseAdmin.from('integrations').insert({ org_id: actionOrgId, provider: 'discord_bot', secret_id: newSecretId }); 
                    }
                }
            } catch (error) {
                console.error(`Failed to save ${provider} integration:`, error.message);
            }
        }

        revalidatePath('/integrations');
        if (redirectUrl) redirect(redirectUrl);
    };

    // ==========================================
    // 🌟 DELETE / UNINSTALL
    // ==========================================
    const deleteIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('users').select('org_id, role').eq('id', user.id).single();
        if (userData?.role !== 'admin') throw new Error("Unauthorized");
        
        const actionOrgId = userData?.org_id;

        try {
            if (provider === 'github') {
                console.log(`🐛 Attempting to uninstall GitHub app for Org: ${actionOrgId}`);
                
                const uninstallRes = await fetch(`https://tron-v3.onrender.com/api/admin/github-uninstall?orgId=${actionOrgId}`, {
                    method: 'DELETE'
                });

                if (!uninstallRes.ok) {
                    const errText = await uninstallRes.text();
                    console.error("❌ Backend GitHub uninstall failed:", uninstallRes.status, errText);
                    throw new Error(`GitHub failed to uninstall. Please check Render logs. Status: ${uninstallRes.status}`);
                }
                
                console.log("✅ GitHub app successfully uninstalled from GitHub API.");
            }

            // ONLY clean up the local database IF the GitHub API call succeeded
            await supabaseServer.from('integrations').delete().match({ provider, org_id: actionOrgId });
            if (provider === 'discord') {
                await supabaseServer.from('integrations').delete().match({ provider: 'discord_bot', org_id: actionOrgId });
            }
        } catch (e) {
            console.error(`Failed to disconnect ${provider}:`, e);
            throw e; 
        }
        revalidatePath('/integrations');
    };

    // 🌟 RENDER UI
    return (
        <div className="max-w-5xl mx-auto p-6 lg:p-8 font-sans">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Integrations</h1>
                <p className="text-gray-500 mt-2 text-lg">Connect your tools to enable TRON&apos;s automated workflows.</p>
            </div>

            {/* 🚨 THE VISUAL DEBUG TRAP 🚨 */}
            {params?.github_error && (
                <div className="bg-red-50 border-l-4 border-red-600 p-5 mb-8 rounded-r-xl shadow-sm">
                    <h3 className="text-red-900 font-bold text-lg flex items-center">
                        <span className="mr-2">⚠️</span> GitHub Connection Failed
                    </h3>
                    <p className="text-red-700 font-mono text-sm mt-2 bg-red-100 p-2 rounded break-all">
                        {params.github_error}
                    </p>
                </div>
            )}

            {/* 🎉 AUTO-DISMISS SUCCESS NOTIFICATION 🎉 */}
            {params?.github_setup === 'success' && (
                <AutoDismissBanner title="GitHub App Connected" />
            )}

            <div className="space-y-12">
                {/* --- VERSION CONTROL --- */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                        <span className="bg-gray-100 text-gray-600 h-8 w-8 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                        Version Control
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 🌟 GITHUB APP CARD */}
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${github ? 'border-gray-300 ring-2 ring-gray-900' : 'border-gray-200'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">🐙</span>
                                    <h3 className="text-lg font-bold text-gray-900">GitHub</h3>
                                </div>
                                {github && <span className="bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <div className="mb-5 flex-grow space-y-4">
                                    <p className="text-gray-500 text-sm">
                                        Install the TRON GitHub App to securely grant granular repository access. No manual tokens required.
                                    </p>
                                </div>

                                {github ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 mt-auto">
                                        <input type="hidden" name="provider" value="github" />
                                        <span className="text-sm font-semibold text-gray-700">App Installed</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <div className="mt-auto">
                                        <a href={`https://github.com/apps/tron-v3/installations/new`} className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm flex items-center justify-center">
                                            Connect GitHub Account
                                        </a>
                                    </div>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* 🌟 BASECAMP CARD */}
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${basecamp ? 'border-indigo-200 ring-2 ring-indigo-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">⛺</span>
                                    <h3 className="text-lg font-bold text-gray-900">Basecamp</h3>
                                </div>
                                {basecamp && <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            
                            <div className="p-6 flex flex-col flex-grow">
                                <div className="mb-5 flex-grow space-y-4">
                                    <p className="text-gray-500 text-sm">
                                        Authorize TRON to sync tasks, auto-assign developers, and manage column states.
                                    </p>
                                </div>

                                {basecamp ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100 mt-auto">
                                        <input type="hidden" name="provider" value="basecamp" />
                                        <span className="text-sm font-semibold text-indigo-900">Account Linked</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4 mt-auto">
                                        <input type="hidden" name="provider" value="basecamp" />
                                        
                                        <div className="space-y-3">
                                            <input name="accountId" type="text" required placeholder="Account ID (e.g. 9999999)" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm placeholder-gray-400" />
                                            
                                            <div className="flex gap-3">
                                                <input name="clientId" type="password" required placeholder="Client ID" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm placeholder-gray-400" />
                                                <input name="clientSecret" type="password" required placeholder="Client Secret" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm placeholder-gray-400" />
                                            </div>
                                        </div>
                                        
                                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Connect Basecamp
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Jira Coming Soon */}
                         <div className="bg-gray-50/50 rounded-2xl border border-dashed border-gray-300 p-6 flex flex-col justify-center items-center text-center opacity-70 min-h-[300px]">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 🌟 DISCORD CARD */}
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${discord ? 'border-blue-200 ring-2 ring-blue-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">🎮</span>
                                    <h3 className="text-lg font-bold text-gray-900">Discord</h3>
                                </div>
                                {discord && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <div className="mb-5 flex-grow space-y-4">
                                    <p className="text-sm text-gray-500">Broadcast AI executive summaries directly to your server.</p>
                                </div>

                                {discord ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100 mt-auto">
                                        <input type="hidden" name="provider" value="discord" />
                                        <span className="text-sm font-semibold text-blue-900">Bot Connected</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4 mt-auto">
                                        <input type="hidden" name="provider" value="discord" />
                                        <div>
                                            <input name="token" type="password" required placeholder="Bot Token" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm placeholder-gray-400 font-mono" />
                                        </div>
                                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm">
                                            Connect Discord
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* 🌟 SLACK CARD */}
                        <div className={`bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border ${slack ? 'border-teal-200 ring-2 ring-teal-500' : 'border-gray-100'} overflow-hidden flex flex-col transition-all`}>
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div className="flex items-center space-x-3">
                                    <span className="text-2xl">💬</span>
                                    <h3 className="text-lg font-bold text-gray-900">Slack</h3>
                                </div>
                                {slack && <span className="bg-teal-100 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">Active</span>}
                            </div>
                            <div className="p-6 flex flex-col flex-grow">
                                <div className="mb-5 flex-grow space-y-4">
                                    <p className="text-sm text-gray-500">Send automated code reviews to your Slack workspace.</p>
                                </div>

                                {slack ? (
                                    <form action={deleteIntegration} className="flex justify-between items-center bg-teal-50 p-4 rounded-xl border border-teal-100 mt-auto">
                                        <input type="hidden" name="provider" value="slack" />
                                        <span className="text-sm font-semibold text-teal-900">Bot Connected</span>
                                        <button type="submit" className="text-red-600 hover:text-red-700 text-sm font-bold transition-colors">Disconnect</button>
                                    </form>
                                ) : (
                                    <form action={saveIntegration} className="space-y-4 mt-auto">
                                        <input type="hidden" name="provider" value="slack" />
                                        <div>
                                            <input name="token" type="password" required placeholder="https://hooks.slack.com/services/..." className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm placeholder-gray-400 font-mono" />
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