import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ClientForm from './ClientForm';
// 🌟 IMPORTED the fetchers to get the names
import { deleteWorkflowAction, fetchBasecampProjects, fetchDiscordChannels } from './actions';

export default async function RepositoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    const { data: userData } = await supabase.from('users').select('org_id').eq('id', user.id).single();
    
    const { data: repositories } = await supabase
        .from('repositories')
        .select('*')
        .eq('org_id', userData?.org_id)
        .order('created_at', { ascending: false });

    // Fetch the absolute truth about what is connected from Supabase
    const { data: integrations } = await supabase
        .from('integrations')
        .select('provider')
        .eq('org_id', userData?.org_id);
        
    const connectedProviders = integrations?.map(i => i.provider) || [];

    // 🌟 NEW: Fetch Project and Channel lists in parallel to get their real names
    const [basecampProjects, discordChannels] = await Promise.all([
        fetchBasecampProjects(),
        fetchDiscordChannels()
    ]);

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-12 pt-8 px-4 sm:px-6 lg:px-8">
            <div className="mb-8">
                <Link href="/" className="text-sm font-bold text-green-600 hover:text-green-700 mb-2 inline-block">
                    ← Back to Dashboard
                </Link>
                <h1 className="text-3xl font-extrabold text-gray-900">📦 Workflow Mapping</h1>
                <p className="text-gray-500 mt-2 text-lg">Map your GitHub repositories to your Project Management boards.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    {/* Pass the truth to the Client Form */}
                    <ClientForm connectedProviders={connectedProviders} />
                </div>

                <div className="lg:col-span-5 space-y-4">
                    <h2 className="text-lg font-bold text-gray-900 mb-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        Active Mappings
                    </h2>
                    
                    {repositories?.length === 0 ? (
                        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
                            <span className="text-4xl block mb-2 opacity-50">📭</span>
                            <h3 className="text-gray-700 font-bold">No mappings found</h3>
                            <p className="text-gray-500 text-sm mt-1">Create your first workflow mapping using the form.</p>
                        </div>
                    ) : (
                        repositories?.map((repo) => {
                            // 🌟 NEW: Find the human-readable names! If not found, gracefully fallback to the ID.
                            const projectName = basecampProjects?.find(p => p.id.toString() === repo.pm_project_id)?.name || repo.pm_project_id;
                            const channelName = discordChannels?.find(c => c.id === repo.communication_config?.channel_id)?.name || repo.communication_config?.channel_id;

                            return (
                                <div key={repo.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 transition-all hover:shadow-md">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xl">🐙</span>
                                        <span className="font-bold text-gray-900 font-mono text-sm">{repo.repo_name}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        <span className="text-lg">⛺</span>
                                        {/* 🌟 Swapped the raw ID for our new projectName variable */}
                                        <span className="font-semibold text-xs text-gray-800">{projectName || 'N/A'}</span>
                                        
                                        {repo.communication_config?.channel_id && (
                                            <>
                                                <span className="ml-2 font-bold text-gray-300">|</span>
                                                <span className="text-lg ml-2">🎮</span>
                                                {/* 🌟 Swapped the raw ID for our new channelName variable, and added a '#' for style */}
                                                <span className="font-semibold text-xs text-indigo-600">
                                                    #{channelName}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    
                                    <form action={deleteWorkflowAction} className="mt-2 text-right">
                                        <input type="hidden" name="workflowId" value={repo.id} />
                                        <button type="submit" className="text-red-500 hover:text-white hover:bg-red-500 border border-red-200 px-3 py-1 rounded text-xs font-bold transition-colors">
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
    );
}