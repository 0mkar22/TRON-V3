import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClientForm from './ClientForm';
import { deleteWorkflowAction, fetchBasecampProjects, fetchDiscordChannels } from './actions';

export default async function RepositoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    // 🌟 UPDATED: Fetch 'role' alongside 'org_id'
    const { data: userData } = await supabase.from('users').select('org_id, role').eq('id', user.id).single();
    
    // 🌟 THE BOUNCER: Kick out developers
    if (userData?.role !== 'admin') {
        redirect('/');
    }
    
    const { data: repositories } = await supabase
        .from('repositories')
        .select('*')
        .eq('org_id', userData?.org_id)
        .order('created_at', { ascending: false });

    const { data: integrations } = await supabase
        .from('integrations')
        .select('provider')
        .eq('org_id', userData?.org_id);
        
    const connectedProviders = integrations?.map(i => i.provider) || [];

    const [basecampProjects, discordChannels] = await Promise.all([
        fetchBasecampProjects(),
        fetchDiscordChannels()
    ]);

    return (
        <div className="max-w-6xl mx-auto p-6 lg:p-8 font-sans">
            <div className="mb-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Workflow Mapping</h1>
                <p className="text-gray-500 mt-2 text-lg">Map your GitHub repositories to your Project Management boards.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Form Side */}
                <div className="lg:col-span-7">
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-900">Create Mapping</h2>
                            <p className="text-sm text-gray-500 mt-1">Configure automation rules for a repository.</p>
                        </div>
                        <div className="p-6 sm:p-8">
                            <ClientForm connectedProviders={connectedProviders} />
                        </div>
                    </div>
                </div>

                {/* Active Mappings Side */}
                <div className="lg:col-span-5">
                    <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden h-full">
                        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-900">Active Mappings</h2>
                            <p className="text-sm text-gray-500 mt-1">Currently syncing repositories.</p>
                        </div>
                        
                        <div className="p-6 sm:p-8 space-y-4">
                            {repositories?.length === 0 ? (
                                <div className="text-center py-12">
                                    <span className="text-4xl block mb-3 opacity-50">📭</span>
                                    <h3 className="text-gray-900 font-bold">No mappings found</h3>
                                    <p className="text-gray-500 text-sm mt-1">Create your first workflow mapping.</p>
                                </div>
                            ) : (
                                repositories?.map((repo) => {
                                    const projectName = basecampProjects?.find(p => p.id.toString() === repo.pm_project_id)?.name || repo.pm_project_id;
                                    const channelName = discordChannels?.find(c => c.id === repo.communication_config?.channel_id)?.name || repo.communication_config?.channel_id;

                                    return (
                                        <div key={repo.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4 hover:border-indigo-300 hover:shadow-md transition-all">
                                            <div className="flex items-center space-x-3 border-b border-gray-100 pb-3">
                                                <span className="text-2xl">🐙</span>
                                                <span className="font-bold text-gray-900">{repo.repo_name}</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold">
                                                    ⛺ {projectName || 'N/A'}
                                                </span>
                                                {repo.communication_config?.channel_id && (
                                                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold">
                                                        🎮 #{channelName}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <form action={deleteWorkflowAction} className="mt-1">
                                                <input type="hidden" name="workflowId" value={repo.id} />
                                                <button type="submit" className="w-full text-center text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2 rounded-lg text-sm font-bold transition-colors">
                                                    Delete Mapping
                                                </button>
                                            </form>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}