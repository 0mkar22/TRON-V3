"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    repoName: '', pmProvider: 'basecamp', pmProjectId: '', todoCol: '', branchCol: '', prCol: '', doneCol: ''
  });

  const [boardColumns, setBoardColumns] = useState([]);
  const [fetchingColumns, setFetchingColumns] = useState(false);
  const [basecampProjects, setBasecampProjects] = useState([]);
  const [isLoadingBcProjects, setIsLoadingBcProjects] = useState(true);
  
  const isBcConnected = connectedProviders.includes('basecamp');
  const isGithubConnected = connectedProviders.includes('github');
  const isDiscordConnected = connectedProviders.includes('discord');
  
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [checkingDiscord, setCheckingDiscord] = useState(true);

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [githubRepos, setGithubRepos] = useState([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);

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
      if (!formData.pmProjectId) return alert("Please select a Project first!");
      setFetchingColumns(true);
      try {
          setBoardColumns(await fetchBasecampColumns(formData.pmProjectId));
      } catch (error) {
          alert("Failed to fetch columns. Check terminal logs.");
      } finally {
          setFetchingColumns(false);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    const payload = {
      repoName: formData.repoName,
      pmProvider: formData.pmProvider,
      pmProjectId: formData.pmProjectId,
      mapping: { todo: formData.todoCol, branch_created: formData.branchCol, pull_request_opened: formData.prCol, pull_request_closed: formData.doneCol },
      communication_config: isDiscordConnected && selectedChannel ? { provider: 'discord_bot', channel_id: selectedChannel } : null
    };

    try {
      const result = await saveWorkflowAction(payload);
      setStatus({ type: 'success', message: result.message });
      setFormData({ repoName: '', pmProvider: 'basecamp', pmProjectId: '', todoCol: '', branchCol: '', prCol: '', doneCol: '' });
      setBoardColumns([]);
      setSelectedChannel('');
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to link repository.' });
    } finally {
      setLoading(false);
    }
  };

  return (
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Source Section */}
        <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900">Source Repository</label>
            {isLoadingRepos ? (
                <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm animate-pulse">Loading repositories...</div>
            ) : !isGithubConnected ? (
                <div className="w-full px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-red-700 text-sm flex justify-between items-center">
                    <span className="font-medium">GitHub not connected.</span>
                    <button type="button" onClick={() => router.push('/integrations')} className="font-bold underline hover:text-red-900">Connect</button>
                </div>
            ) : (
                <select required value={formData.repoName} onChange={(e) => setFormData({ ...formData, repoName: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm">
                    <option value="" disabled>Select a repository...</option>
                    {githubRepos.length > 0 ? githubRepos.map((repo) => <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>) : <option disabled>Failed to load repos</option>}
                </select>
            )}
        </div>

        {/* PM Section */}
        <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900">Target Project</label>
            <div className="flex flex-col sm:flex-row gap-3">
                <select className="w-full sm:w-1/3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" value={formData.pmProvider} onChange={(e) => setFormData({ ...formData, pmProvider: e.target.value })}>
                    <option value="basecamp">Basecamp</option>
                </select>

                <div className="w-full sm:w-2/3 flex gap-2">
                    {isLoadingBcProjects ? (
                        <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm animate-pulse">Loading projects...</div>
                    ) : !isBcConnected ? (
                        <div className="w-full px-4 py-3 border border-red-200 rounded-xl bg-red-50 text-red-700 text-sm flex justify-between items-center">
                            <span className="font-medium">Basecamp not connected.</span>
                        </div>
                    ) : (
                        <select required value={formData.pmProjectId} onChange={(e) => setFormData({ ...formData, pmProjectId: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm">
                            <option value="" disabled>Select a project...</option>
                            {basecampProjects.length > 0 ? basecampProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option disabled>Failed to load projects</option>}
                        </select>
                    )}
                    <button type="button" onClick={handleFetchColumns} disabled={fetchingColumns || !formData.pmProjectId} className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl transition-colors disabled:opacity-50 whitespace-nowrap text-sm font-bold shadow-sm">
                        {fetchingColumns ? '...' : 'Fetch'}
                    </button>
                </div>
            </div>
        </div>

        {/* Board Mapping Section */}
        {boardColumns.length > 0 && (
            <div className="p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">To-Do Column</label>
                <select required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.todoCol} onChange={(e) => setFormData({ ...formData, todoCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">In Progress (Branch)</label>
                <select required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.branchCol} onChange={(e) => setFormData({ ...formData, branchCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">In Review (PR)</label>
                <select required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.prCol} onChange={(e) => setFormData({ ...formData, prCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Done</label>
                <select required className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.doneCol} onChange={(e) => setFormData({ ...formData, doneCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
            </div>
        )}

        {/* Broadcast Section */}
        <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-900">Broadcast Channel</label>
            {checkingDiscord ? (
                 <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm animate-pulse">Checking status...</div>
            ) : isDiscordConnected ? (
                <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
                    <option value="">-- Select Discord Channel (Optional) --</option>
                    {channels.length > 0 ? channels.map(channel => <option key={channel.id} value={channel.id}># {channel.name}</option>) : <option disabled>Failed to load channels</option>}
                </select>
            ) : (
                <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 text-sm flex justify-between items-center">
                    <span>Discord not connected.</span>
                </div>
            )}
        </div>

        {status.message && (
            <div className={`p-4 rounded-xl text-sm flex items-start ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                <span className="font-medium">{status.message}</span>
            </div>
        )}

        <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 transition-all duration-200">
          {loading ? 'Saving Mapping...' : 'Save Workflow Mapping'}
        </button>
      </form>
  );
}