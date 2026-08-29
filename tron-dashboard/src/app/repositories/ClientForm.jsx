"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    saveWorkflowAction, 
    fetchGithubRepos, 
    fetchBasecampProjects, 
    fetchDiscordChannels, 
    fetchBasecampColumns 
} from './actions';

export default function ClientForm({ connectedProviders = [] }) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    repoName: '', pmProvider: '', pmProjectId: '', teamKey: '', todoCol: '', branchCol: '', prCol: '', doneCol: ''
  });
  
  const [boardColumns, setBoardColumns] = useState([]);
  const [fetchingColumns, setFetchingColumns] = useState(false);
  const [basecampProjects, setBasecampProjects] = useState([]);
  const [isLoadingBcProjects, setIsLoadingBcProjects] = useState(true);

  // Identify which integrations are active
  const isBcConnected = connectedProviders.includes('basecamp');
  const isJiraConnected = connectedProviders.includes('jira');
  const isLinearConnected = connectedProviders.includes('linear');
  const isGithubConnected = connectedProviders.includes('github');
  const isDiscordConnected = connectedProviders.includes('discord');
  const isSlackConnected = connectedProviders.includes('slack');

  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [checkingDiscord, setCheckingDiscord] = useState(true);
  
  // New Broadcast Provider State
  const [broadcastProvider, setBroadcastProvider] = useState(''); 

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  
  const [githubRepos, setGithubRepos] = useState([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);

  useEffect(() => {
    if (!formData.pmProvider) {
      if (isBcConnected) setFormData(prev => ({ ...prev, pmProvider: 'basecamp' }));
      else if (isJiraConnected) setFormData(prev => ({ ...prev, pmProvider: 'jira' }));
      else if (isLinearConnected) setFormData(prev => ({ ...prev, pmProvider: 'linear' }));
    }
  }, [isBcConnected, isJiraConnected, isLinearConnected, formData.pmProvider]);

  useEffect(() => {
    if (!isGithubConnected) { setIsLoadingRepos(false); return; }
    const loadRepos = async () => { setGithubRepos(await fetchGithubRepos()); setIsLoadingRepos(false); };
    loadRepos();
  }, [isGithubConnected]);

  useEffect(() => {
    if (!isBcConnected) { setIsLoadingBcProjects(false); return; }
    const loadProjects = async () => { setBasecampProjects(await fetchBasecampProjects()); setIsLoadingBcProjects(false); };
    loadProjects();
  }, [isBcConnected]);

  useEffect(() => {
    if (!isDiscordConnected) { setCheckingDiscord(false); return; }
    const loadChannels = async () => { setChannels(await fetchDiscordChannels()); setCheckingDiscord(false); };
    loadChannels();
  }, [isDiscordConnected]);

  const handleFetchColumns = async () => {
      // FIX: Replaced native alert with inline status banner
      if (!formData.pmProjectId) {
          setStatus({ type: 'error', message: "Please select a Project first!" });
          return;
      }
      
      setFetchingColumns(true);
      setStatus({ type: '', message: '' });
      try {
          if (formData.pmProvider === 'basecamp') {
              setBoardColumns(await fetchBasecampColumns(formData.pmProjectId));
          }
      } catch (error) {
          // FIX: Replaced native alert with inline status banner
          setStatus({ type: 'error', message: "Failed to fetch columns. Check terminal logs." });
      } finally {
          setFetchingColumns(false);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    let finalMapping = {};
    if (formData.pmProvider === 'basecamp') {
        finalMapping = { todo: formData.todoCol, branch_created: formData.branchCol, pull_request_opened: formData.prCol, pull_request_closed: formData.doneCol };
    } else if (formData.pmProvider === 'linear') {
        finalMapping = { team_key: formData.teamKey.toUpperCase().trim() };
    }

    // Configure communication payload based on explicit provider selection
    let commConfig = null;
    if (broadcastProvider === 'slack') {
        commConfig = { provider: 'slack' };
    } else if (broadcastProvider === 'discord' && selectedChannel) {
        commConfig = { provider: 'discord_bot', channel_id: selectedChannel };
    }

    const payload = {
        repoName: formData.repoName,
        pmProvider: formData.pmProvider,
        pmProjectId: formData.pmProjectId.trim(),
        mapping: finalMapping,
        communication_config: commConfig
    };

    try {
        const result = await saveWorkflowAction(payload);
        
        if (result.success) {
            setStatus({ type: 'success', message: result.message });
            // FIX: Only wipe the repository name so the user can quickly map another repo to the same project
            setFormData({ ...formData, repoName: '' }); 
        } else {
            setStatus({ type: 'error', message: `Database Error: ${result.message}` });
        }
    } catch (error) {
        setStatus({ type: 'error', message: error.message || 'Failed to link repository.' });
    } finally {
        setLoading(false);
    }
  };

  const isSubmitDisabled = 
     loading || 
     !formData.repoName || 
     !formData.pmProjectId || 
     (formData.pmProvider === 'basecamp' && (boardColumns.length === 0 || !formData.todoCol || !formData.branchCol || !formData.prCol || !formData.doneCol)) ||
    (formData.pmProvider === 'linear' && !formData.teamKey);

  return (
      <form onSubmit={handleSubmit} className="space-y-8">
         {/* Source Section */}
        <div className="space-y-4">
            {/* FIX: Added htmlFor */}
            <label htmlFor="repoName" className="block font-black text-xl mb-2 uppercase text-black">Source Repository</label>
            {isLoadingRepos ? (
                <div className="w-full p-4 border-4 border-black bg-white text-black font-mono font-bold shadow-brutal animate-pulse">Loading repositories...</div>
            ) : !isGithubConnected ? (
                <div className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal flex justify-between items-center">
                    <span className="font-medium">GitHub not connected.</span>
                    <button type="button" onClick={() => router.push('/integrations')} className="btn-brutal bg-white px-4 py-2 text-black">Connect</button>
                </div>
            ) : githubRepos.length === 0 ? (
                // FIX: Inline error box instead of hiding it inside the select menu
                <div className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal">
                    No repositories found. Ensure your GitHub App has access to your repositories.
                </div>
            ) : (
                <select id="repoName" required value={formData.repoName} onChange={(e) => setFormData({ ...formData, repoName: e.target.value })} className="input-brutal text-black">
                    <option value="" disabled>Select a repository...</option>
                    {githubRepos.map((repo) => <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>)}
                </select>
            )}
        </div>

        {/* PM Section */}
        <div className="space-y-4">
            <label htmlFor="pmProvider" className="block font-black text-xl mb-2 uppercase text-black">Target Project</label>
            
            {!isBcConnected && !isJiraConnected && !isLinearConnected ? (
                <div className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal flex justify-between items-center">
                    <span className="font-medium">No Project Management tools connected.</span>
                    <button type="button" onClick={() => router.push('/integrations')} className="btn-brutal bg-white px-4 py-2 text-black">Connect a Tool</button>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                    <select 
                        id="pmProvider"
                        className="input-brutal text-black" 
                        value={formData.pmProvider} 
                        onChange={(e) => {
                            setFormData({ ...formData, pmProvider: e.target.value, pmProjectId: '', teamKey: '', todoCol: '', branchCol: '', prCol: '', doneCol: '' });
                            setBoardColumns([]);
                        }}
                    >
                        <option value="" disabled>Select Provider</option>
                        {isBcConnected && <option value="basecamp">Basecamp</option>}
                        {isJiraConnected && <option value="jira">Jira</option>}
                        {isLinearConnected && <option value="linear">Linear</option>}
                    </select>
                    
                    <div className="w-full sm:w-2/3 flex gap-2">
                        {formData.pmProvider === 'basecamp' && (
                            <>
                                {isLoadingBcProjects ? (
                                    <div className="w-full p-4 border-4 border-black bg-white text-black font-mono font-bold shadow-brutal animate-pulse">Loading projects...</div>
                                ) : basecampProjects.length === 0 ? (
                                    // FIX: Error box for empty Basecamp projects
                                    <div className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal">
                                        No Basecamp projects found.
                                    </div>
                                ) : (
                                    <select id="pmProjectId" aria-label="Basecamp Project" required value={formData.pmProjectId} onChange={(e) => setFormData({ ...formData, pmProjectId: e.target.value })} className="input-brutal text-black">
                                        <option value="" disabled>Select a project...</option>
                                        {basecampProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                                    </select>
                                )}
                                <button type="button" onClick={handleFetchColumns} disabled={fetchingColumns || !formData.pmProjectId} className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap text-sm font-bold shadow-sm">
                                    {fetchingColumns ? '...' : 'Fetch'}
                                </button>
                            </>
                        )}

                        {formData.pmProvider === 'jira' && (
                            <div className="w-full px-4 py-3 border border-sky-200 rounded-xl bg-sky-50 text-sky-700 text-sm flex items-center">
                                <span className="font-medium">Jira workspace selected. Enter the Project Key below.</span>
                            </div>
                        )}

                        {formData.pmProvider === 'linear' && (
                            <div className="w-full px-4 py-3 border border-purple-200 rounded-xl bg-purple-50 text-purple-700 text-sm flex items-center">
                                <span className="font-medium">Linear selected. Enter Team details below.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* JIRA PROJECT KEY INPUT */}
        {formData.pmProvider === 'jira' && (
            <div className="space-y-4">
                <label htmlFor="jiraKey" className="block font-black text-xl mb-2 uppercase text-black">Jira Project Key</label>
                <input 
                    id="jiraKey"
                    type="text" 
                    required 
                    placeholder="e.g. TRON, ENG, PROJ" 
                    value={formData.pmProjectId} 
                    onChange={(e) => setFormData({ ...formData, pmProjectId: e.target.value.toUpperCase() })} 
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">This is the short prefix on your Jira tickets.</p>
            </div>
        )}

        {/* LINEAR PROJECT MAPPING */}
        {formData.pmProvider === 'linear' && (
            <div className="space-y-4 p-5 bg-purple-50/50 border border-purple-100 rounded-xl animate-fade-in-up">
                <div>
                    <label htmlFor="linearKey" className="block text-sm font-semibold text-purple-900">Linear Team Key</label>
                    <input 
                        id="linearKey"
                        type="text" 
                        required 
                        placeholder="e.g. ENG, DES, PROD" 
                        value={formData.pmProjectId} 
                        onChange={(e) => setFormData({ 
                            ...formData, 
                            pmProjectId: e.target.value.toUpperCase(),
                            teamKey: e.target.value.toUpperCase() 
                        })} 
                        className="w-full mt-1.5 px-4 py-3 bg-white border border-purple-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm font-mono placeholder-gray-400"
                    />
                    <p className="text-xs text-purple-700 mt-1.5">
                        This is the short prefix on your Linear issues.
                    </p>
                </div>
            </div>
        )}

        {/* Basecamp Board Mapping Section */}
        {formData.pmProvider === 'basecamp' && boardColumns.length > 0 && (
            <div className="p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="todoCol" className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">To-Do Column</label>
                <select id="todoCol" required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.todoCol} onChange={(e) => setFormData({ ...formData, todoCol: e.target.value })}>
                  <option value="" disabled>Select a Basecamp Column...</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="branchCol" className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">In Progress (Branch)</label>
                <select id="branchCol" required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.branchCol} onChange={(e) => setFormData({ ...formData, branchCol: e.target.value })}>
                  <option value="" disabled>Select a Basecamp Column...</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="prCol" className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">In Review (PR)</label>
                <select id="prCol" required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.prCol} onChange={(e) => setFormData({ ...formData, prCol: e.target.value })}>
                  <option value="" disabled>Select a Basecamp Column...</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="doneCol" className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Done</label>
                <select id="doneCol" required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.doneCol} onChange={(e) => setFormData({ ...formData, doneCol: e.target.value })}>
                  <option value="" disabled>Select a Basecamp Column...</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
            </div>
        )}

        {/* Broadcast Section */}
        <div className="space-y-4">
            <label htmlFor="broadcastProvider" className="block font-black text-xl mb-2 uppercase text-black">Broadcast Channel</label>
            
            <select 
                id="broadcastProvider"
                className="input-brutal text-black"
                value={broadcastProvider}
                onChange={(e) => {
                    setBroadcastProvider(e.target.value);
                    setSelectedChannel('');
                }}
            >
                <option value="">No Notifications (Muted)</option>
                {isSlackConnected && <option value="slack">💬 Slack Workspace</option>}
                {isDiscordConnected && <option value="discord">🎮 Discord Server</option>}
            </select>

            {broadcastProvider === 'slack' && (
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl animate-fade-in-up">
                    <h4 className="text-sm font-bold text-emerald-900 flex items-center">
                        <span className="mr-2">✅</span> Slack Broadcast Active
                    </h4>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        TRON will route automated updates directly to your configured incoming webhook channel workspace.
                    </p>
                </div>
            )}

            {broadcastProvider === 'discord' && (
                <div className="animate-fade-in-up space-y-2">
                    {checkingDiscord ? (
                         <div className="w-full p-4 border-4 border-black bg-white text-black font-mono font-bold shadow-brutal animate-pulse">Loading Discord channels...</div>
                    ) : channels.length > 0 ? (
                        <select 
                            required
                            aria-label="Discord Channel"
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" 
                            value={selectedChannel} 
                            onChange={(e) => setSelectedChannel(e.target.value)}
                        >
                            <option value="" disabled>Select a Discord Channel...</option>
                            {channels.map(channel => <option key={channel.id} value={channel.id}># {channel.name}</option>)}
                        </select>
                    ) : (
                        <div className="w-full p-4 border-4 border-black bg-brutal-pink text-black font-mono font-bold shadow-brutal">
                            Failed to resolve active channels. Verify bot server deployment permissions.
                        </div>
                    )}
                </div>
            )}
        </div>

        {status.message && (
            <div className={`p-4 rounded-xl text-sm flex items-start ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                <span className="font-medium">{status.message}</span>
            </div>
        )}

        <button 
           type="submit" 
           disabled={isSubmitDisabled} 
           className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? 'Saving Mapping...' : 'Save Workflow Mapping'}
        </button>
      </form>
  );
}