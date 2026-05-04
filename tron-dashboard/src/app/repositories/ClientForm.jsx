"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 🌟 NEW: Import all our secure server proxies!
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
    repoName: '',
    pmProvider: 'basecamp',
    pmProjectId: '',
    todoCol: '',
    branchCol: '',
    prCol: '',
    doneCol: ''
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

  // 1. GitHub Effect
  useEffect(() => {
    if (!isGithubConnected) {
        setIsLoadingRepos(false);
        return;
    }
    const loadRepos = async () => {
        const repos = await fetchGithubRepos();
        setGithubRepos(repos);
        setIsLoadingRepos(false);
    };
    loadRepos();
  }, [isGithubConnected, setIsLoadingRepos]); // ✅ Added back

  // 2. Basecamp Effect
  useEffect(() => {
    if (!isBcConnected) {
        setIsLoadingBcProjects(false);
        return;
    }
    const loadProjects = async () => {
        const projects = await fetchBasecampProjects();
        setBasecampProjects(projects);
        setIsLoadingBcProjects(false);
    };
    loadProjects();
  }, [isBcConnected, setIsLoadingBcProjects]); // ✅ Added back

  // 3. Discord Effect
  useEffect(() => {
    if (!isDiscordConnected) {
        setCheckingDiscord(false);
        return;
    }
    const loadChannels = async () => {
      const fetchedChannels = await fetchDiscordChannels();
      setChannels(fetchedChannels);
      setCheckingDiscord(false);
    };
    loadChannels();
  }, [isDiscordConnected, setCheckingDiscord]); // ✅ Added back

  // 🌟 REFACTORED: Use Server Action for Columns
  const handleFetchColumns = async () => {
      if (!formData.pmProjectId) return alert("Please enter a Project / Board ID first!");
      setFetchingColumns(true);
      try {
          const columns = await fetchBasecampColumns(formData.pmProjectId);
          setBoardColumns(columns);
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
      mapping: {
        todo: formData.todoCol,
        branch_created: formData.branchCol,
        pull_request_opened: formData.prCol,
        pull_request_closed: formData.doneCol 
      },
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">GitHub Repository</label>
            {isLoadingRepos ? (
            <div className="w-full border border-gray-300 p-2.5 rounded-lg bg-gray-50 text-gray-400 text-sm animate-pulse">Loading repositories...</div>
            ) : !isGithubConnected ? (
            <div className="w-full border border-red-300 p-2.5 rounded-lg bg-red-50 text-red-600 text-sm flex justify-between items-center">
                <span>GitHub not connected.</span>
                <Link href="/integrations" className="font-bold underline hover:text-red-800">Connect PAT</Link>
            </div>
            ) : (
            <select required value={formData.repoName} onChange={(e) => setFormData({ ...formData, repoName: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm bg-white">
                <option value="" disabled>Select a repository...</option>
                {githubRepos.length > 0 ? githubRepos.map((repo) => <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>) : <option disabled>Failed to load repos from Render</option>}
            </select>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">PM Tool</label>
              <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50" value={formData.pmProvider} onChange={(e) => setFormData({ ...formData, pmProvider: e.target.value })}>
                <option value="basecamp">Basecamp</option>
              </select>
            </div>
            <div className="w-full sm:w-2/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project / Board ID</label>
              <div className="flex gap-2">
                  {isLoadingBcProjects ? (
                      <div className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-400 animate-pulse">Loading projects...</div>
                  ) : !isBcConnected ? (
                      <div className="w-full px-4 py-2 border border-red-300 rounded-md bg-red-50 text-red-600 text-sm flex justify-between items-center">
                          <span>Basecamp not connected.</span>
                          <Link href="/integrations" className="font-bold underline hover:text-red-800">Connect</Link>
                      </div>
                  ) : (
                      <select required value={formData.pmProjectId} onChange={(e) => setFormData({ ...formData, pmProjectId: e.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white">
                          <option value="" disabled>Select a project...</option>
                          {basecampProjects.length > 0 ? basecampProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : <option disabled>Failed to load projects</option>}
                      </select>
                  )}
                  <button type="button" onClick={handleFetchColumns} disabled={fetchingColumns || !formData.pmProjectId} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 whitespace-nowrap text-sm font-bold">
                      {fetchingColumns ? 'Loading...' : 'Fetch Columns'}
                  </button>
              </div>
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-200" />
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Automation Mapping</h3>

        {boardColumns.length === 0 ? (
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 text-center">
                <p className="text-blue-800 font-medium">Select your Board ID above and click &ldquo;Fetch Columns&ldquo; to map your workflow.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">To-Do Column</label>
                <select required className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500" value={formData.todoCol} onChange={(e) => setFormData({ ...formData, todoCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">In Progress Column</label>
                <select required className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500" value={formData.branchCol} onChange={(e) => setFormData({ ...formData, branchCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">In Review Column</label>
                <select required className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500" value={formData.prCol} onChange={(e) => setFormData({ ...formData, prCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Done Column</label>
                <select required className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500" value={formData.doneCol} onChange={(e) => setFormData({ ...formData, doneCol: e.target.value })}>
                  <option value="">-- Select Column --</option>
                  {boardColumns.map(col => <option key={col.id} value={col.id}>{col.name}</option>)}
                </select>
              </div>
            </div>
        )}

        <hr className="my-6 border-gray-200" />
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><span className="mr-2">🎮</span> Broadcast Configuration</h3>
        
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            {checkingDiscord ? (
                 <div className="text-sm text-gray-500 animate-pulse">Checking Discord integration status...</div>
            ) : isDiscordConnected ? (
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Discord Channel</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white" value={selectedChannel} onChange={(e) => setSelectedChannel(e.target.value)}>
                        <option value="">-- Choose a channel --</option>
                        {channels.length > 0 ? channels.map(channel => <option key={channel.id} value={channel.id}># {channel.name}</option>) : <option disabled>Failed to load channels</option>}
                    </select>
                </div>
            ) : (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex flex-col sm:flex-row justify-between items-center">
                    <span className="text-sm text-indigo-800 font-medium mb-3 sm:mb-0">Broadcasts disabled. Discord is not connected.</span>
                    <button type="button" onClick={() => router.push('/integrations')} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors">Connect Discord</button>
                </div>
            )}
        </div>

        {status.message && (
          <div className={`p-4 rounded-md font-bold text-sm ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {status.message}
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4 text-lg shadow-md">
          {loading ? 'Saving...' : 'Link Repository'}
        </button>
      </form>
  );
}