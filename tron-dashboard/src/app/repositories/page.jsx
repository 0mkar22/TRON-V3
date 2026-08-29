import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ClientForm from './ClientForm';
import { deleteWorkflowAction, fetchBasecampProjects, fetchDiscordChannels } from './actions';
import DeleteButton from './DeleteButton';

export default async function RepositoriesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return redirect('/login');

    // 🌟 UPDATED: Fetch 'role' alongside 'org_id'
    const { data: userData } = await supabase.from('organization_members').select('org_id, role').eq('user_id', user.id).limit(1).then(({data, error}) => ({ data: data?.[0], error }));
    
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
        <div className="p-8 max-w-7xl mx-auto font-sans">
            <div className="mb-8 border-b-8 border-black pb-4">
                <h1 className="text-5xl font-black uppercase text-black">Workflow Mapping</h1>
                <p className="font-mono text-xl font-bold text-black mt-2">Map GitHub Repositories to Project Management Boards</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                
                {/* Form Side */}
                <div className="xl:col-span-5">
                    <div className="bg-brutal-orange border-4 border-black shadow-brutal-lg flex flex-col h-full">
                        <div className="p-6 border-b-4 border-black bg-white">
                            <h2 className="text-3xl font-black uppercase text-black">Create Mapping</h2>
                        </div>
                        <div className="p-6 bg-white flex-grow">
                            <ClientForm connectedProviders={connectedProviders} />
                        </div>
                    </div>
                </div>

                {/* Active Mappings Side */}
                <div className="xl:col-span-7">
                    <div className="bg-brutal-green border-4 border-black shadow-brutal-lg flex flex-col h-full">
                        <div className="p-6 border-b-4 border-black bg-white flex justify-between items-center">
                            <h2 className="text-3xl font-black uppercase text-black">Active Mappings</h2>
                        </div>
                        
                        <div className="p-6 bg-white flex-grow space-y-4">
                            {repositories?.length === 0 ? (
                                <div className="text-center py-12 border-4 border-black border-dashed">
                                    <span className="font-mono text-2xl font-bold uppercase text-black">NO MAPPINGS FOUND</span>
                                </div>
                            ) : (
                                repositories?.map((repo) => {
                                    let parsedMapping = {};
                                    try { parsedMapping = typeof repo.mapping === 'string' ? JSON.parse(repo.mapping) : (repo.mapping || {}); } catch(e) {}
                                    const projectName = basecampProjects?.find(p => p.id.toString() === repo.pm_project_id)?.name || parsedMapping.team_key || repo.pm_project_id;
                                    const channelName = discordChannels?.find(c => c.id === repo.communication_config?.channel_id)?.name || repo.communication_config?.channel_id;

                                    return (
                                        <div key={repo.id} className="bg-white p-6 border-4 border-black shadow-brutal flex flex-col gap-4">
                                            <div className="flex items-center space-x-3 border-b-4 border-black pb-4">
                                                <span className="text-3xl font-black uppercase text-black">{repo.repo_name}</span>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-4">
                                                <span className="inline-flex items-center px-4 py-2 border-2 border-black bg-brutal-blue text-black font-mono font-bold uppercase shadow-brutal">
                                                    {repo.pm_provider}: {projectName || 'N/A'}
                                                </span>

                                                {repo.communication_config?.provider === 'slack' && (
                                                <span className="inline-flex items-center px-4 py-2 border-2 border-black bg-brutal-pink text-black font-mono font-bold uppercase shadow-brutal">
                                                    SLACK ENABLED
                                                </span>
                                                )}
                                                
                                                {repo.communication_config?.channel_id && (
                                                    <span className="inline-flex items-center px-4 py-2 border-2 border-black bg-brutal-orange text-black font-mono font-bold uppercase shadow-brutal">
                                                        DISCORD: #{channelName}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="mt-2">
                                                <DeleteButton workflowId={repo.id} />
                                            </div>
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