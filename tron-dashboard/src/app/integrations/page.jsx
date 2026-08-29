import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import AutoDismissBanner from '@/components/AutoDismissBanner';

// Force Vercel to never cache this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function IntegrationsPage({ searchParams }) {
    // 🌟 Await searchParams for Next.js 15 compatibility
    const params = await searchParams;

    // 1. Initialize Supabase & Get User securely on the server
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    const { data: userData } = await supabase.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
    
    // THE BOUNCER: Kick out developers
    if (userData?.role !== 'admin') {
        redirect('/');
    }

    const secureOrgId = userData?.org_id;

    // Fetch existing integrations
    const { data: integrations } = await supabase.from('integrations').select('*').eq('org_id', secureOrgId);

    const getIntegration = (provider) => integrations?.find(i => i.provider === provider);
    const github = getIntegration('github');
    const basecamp = getIntegration('basecamp');
    const jira = getIntegration('jira'); // 🌟 ADDED JIRA
    const linear = getIntegration('linear'); // ⧓ ADDED LINEAR
    const discord = getIntegration('discord');
    const slack = getIntegration('slack');

    // ==========================================
    // 🌟 GITHUB APP SERVER ACTION (MANUAL TRIGGER)
    // ==========================================
    const finalizeGitHubSetup = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const installationId = formData.get('installationId');

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
        if (userData?.role !== 'admin') throw new Error("Unauthorized");

        const actionOrgId = userData.org_id;
        const supabaseAdmin = createAdminClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        try {
            console.log(`🚀 [GITHUB SETUP] Attempting to save ID: ${installationId} for Org: ${actionOrgId}`);
            
            // 1. Save to Vault
            const { data: newSecretId, error: vaultError } = await supabaseAdmin.rpc('insert_secret', {
                secret_name: `github_app_install_${actionOrgId}_${Date.now()}`,
                secret_description: `GitHub Installation ID for Org ${actionOrgId}`,
                secret_value: installationId.toString()
            });

            if (vaultError) throw new Error(`Vault Error: ${vaultError.message}`);
            if (!newSecretId) throw new Error("Vault returned no secret ID");

            // 2. Upsert to Integrations Table safely
            const { error: upsertError } = await supabaseAdmin
                .from('integrations')
                .upsert({ 
                    org_id: actionOrgId, 
                    provider: 'github', 
                    secret_id: newSecretId 
                }, { onConflict: 'org_id, provider' });

            if (upsertError) throw new Error(`DB Error: ${upsertError.message}`);

            console.log("✅ [GITHUB SETUP] Success!");
        } catch (error) {
            console.error("❌ [GITHUB SETUP] Failed:", error);
            redirect(`/integrations?github_error=${encodeURIComponent(error.message)}`);
        }

        revalidatePath('/integrations');
        redirect('/integrations?github_setup=success');
    };

    // ==========================================
    // 🌟 SECURE VAULT SERVER ACTIONS (SLACK, DISCORD, BASECAMP, JIRA)
    // ==========================================
    const saveIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        let redirectUrl = null;

        const { data: { session } } = await supabaseServer.auth.getSession();
        const token = session?.access_token;

        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
        
        if (userData?.role !== 'admin') throw new Error("Unauthorized");
        const actionOrgId = userData?.org_id;

        if (provider === 'basecamp') {
            try {
                const res = await fetch(`${process.env.BACKEND_URL}/api/auth/basecamp/init`, {
                    method: 'POST', 
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
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
                } else {
                    const errText = await res.text();
                    console.error("❌ Backend Basecamp Init Failed:", res.status, errText);
                }
            } catch (error) {
                console.error(`❌ Failed to init Basecamp via Render:`, error);
            }
        } else if (provider === 'jira') {
            // 🌟 ADDED JIRA HANDLER
            try {
                const res = await fetch(`${process.env.BACKEND_URL}/api/integrations/jira`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Pass the user token to the Go backend
                    },
                    body: JSON.stringify({
                        baseUrl: formData.get('baseUrl'),
                        email: formData.get('email'),
                        apiToken: formData.get('apiToken')
                    })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    console.error("❌ Backend Jira Save Failed:", res.status, errText);
                }
            } catch (error) {
                console.error(`❌ Failed to save Jira via backend:`, error);
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

    const deleteIntegration = async (formData) => {
        'use server';
        const supabaseServer = await createClient();
        const provider = formData.get('provider');
        
        const { data: { session } } = await supabaseServer.auth.getSession();
        const token = session?.access_token;
        
        const { data: { user } } = await supabaseServer.auth.getUser();
        const { data: userData } = await supabaseServer.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
        if (userData?.role !== 'admin') throw new Error("Unauthorized");
        
        const actionOrgId = userData?.org_id;

        try {
            if (provider === 'github') {
                console.log(`🐛 Attempting to uninstall GitHub app for Org: ${actionOrgId}`);
                console.log(`🚨 TARGET BACKEND URL IS: ${process.env.BACKEND_URL}`);
                
                const uninstallRes = await fetch(`${process.env.BACKEND_URL}/api/admin/github-uninstall?orgId=${actionOrgId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}` 
                    }
                });

                if (!uninstallRes.ok) {
                    const errText = await uninstallRes.text();
                    console.error("❌ Backend GitHub uninstall failed:", uninstallRes.status, errText);
                    throw new Error(`GitHub failed to uninstall. Please check Render logs. Status: ${uninstallRes.status}`);
                }
                
                console.log("✅ GitHub app successfully uninstalled from GitHub API.");
            }

            // ONLY clean up the local database IF the API call succeeded
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
        <div className="p-8 max-w-7xl mx-auto font-sans">
            <h1 className="text-5xl font-black uppercase mb-8 border-b-8 border-black pb-4 text-black">Integrations Hub</h1>
            
            {params?.installation_id && params?.github_setup !== 'success' && (
                <div className="bg-brutal-orange border-4 border-black p-6 mb-8 shadow-brutal flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-2xl uppercase text-black">Finish GitHub Setup</h3>
                        <p className="font-mono font-bold text-black mt-2">GitHub authorized TRON. Finalize connection.</p>
                    </div>
                    <form action={finalizeGitHubSetup}>
                        <input type="hidden" name="installationId" value={params.installation_id} />
                        <button type="submit" className="btn-brutal bg-white px-6 py-4 text-xl text-black">FINALIZE</button>
                    </form>
                </div>
            )}

            {params?.github_error && (
                <div className="bg-brutal-pink border-4 border-black p-6 mb-8 shadow-brutal">
                    <h3 className="font-black text-2xl uppercase text-black">GitHub Connection Failed</h3>
                    <p className="font-mono font-bold text-black bg-white border-2 border-black p-2 mt-2 break-all">{params.github_error}</p>
                </div>
            )}

            {params?.github_setup === 'success' && (
                <div className="bg-brutal-green border-4 border-black p-6 mb-8 shadow-brutal">
                    <h3 className="font-black text-2xl uppercase text-black">GitHub App Connected Successfully</h3>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* GITHUB */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-green">
                        <h2 className="text-3xl font-black uppercase text-black">GITHUB</h2>
                    </div>
                    <div className="p-6 flex-grow">
                        <p className="font-mono font-bold text-black">STATUS: {github ? 'CONNECTED' : 'DISCONNECTED'}</p>
                    </div>
                    <div className="p-6 pt-0 mt-auto">
                        {github ? (
                            <form action={deleteIntegration}>
                                <input type="hidden" name="provider" value="github" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        ) : (
                            <a href="https://github.com/apps/tron-v3-1/installations/new" className="block w-full btn-brutal bg-white text-black text-xl py-4 text-center">CONNECT</a>
                        )}
                    </div>
                </div>

                {/* JIRA */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-blue">
                        <h2 className="text-3xl font-black uppercase text-black">JIRA</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {jira ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!jira && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="jira" />
                                <input name="baseUrl" type="url" required placeholder="https://your-domain.atlassian.net" className="input-brutal text-black" />
                                <input name="email" type="email" required placeholder="admin@acmecorp.com" className="input-brutal text-black" />
                                <input name="apiToken" type="password" required placeholder="Jira API Token" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {jira && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="jira" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>

                {/* SLACK */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-orange">
                        <h2 className="text-3xl font-black uppercase text-black">SLACK</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {slack ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!slack && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="slack" />
                                <input name="token" type="password" required placeholder="Webhook URL" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {slack && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="slack" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>
                
                {/* DISCORD */}
                <div className="bg-white border-4 border-black shadow-brutal-lg flex flex-col">
                    <div className="p-4 border-b-4 border-black bg-brutal-pink">
                        <h2 className="text-3xl font-black uppercase text-black">DISCORD</h2>
                    </div>
                    <div className="p-6 flex-grow space-y-4">
                        <p className="font-mono font-bold text-black mb-4">STATUS: {discord ? 'CONNECTED' : 'DISCONNECTED'}</p>
                        {!discord && (
                            <form action={saveIntegration} className="space-y-4">
                                <input type="hidden" name="provider" value="discord" />
                                <input name="token" type="password" required placeholder="Bot Token" className="input-brutal text-black" />
                                <button type="submit" className="w-full btn-brutal bg-white text-black text-xl py-4">CONNECT</button>
                            </form>
                        )}
                        {discord && (
                            <form action={deleteIntegration} className="mt-auto">
                                <input type="hidden" name="provider" value="discord" />
                                <button type="submit" className="w-full btn-brutal bg-brutal-pink text-black text-xl py-4">DISCONNECT</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
