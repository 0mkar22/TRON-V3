"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation'; // 🌟 NEW: Added router for redirecting

export default function RepositoriesPage() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    orgId: '',
    repoName: '',
    pmProvider: 'basecamp',
    pmProjectId: '',
    todoCol: '',
    branchCol: '',
    prCol: '',
    doneCol: ''
  });
  
  // 🌟 REFACTORED: Discord Broadcast States
  const [isDiscordConnected, setIsDiscordConnected] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [checkingDiscord, setCheckingDiscord] = useState(true);

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  // 🌟 NEW: Automatically check global Discord status and fetch channels on load
  useEffect(() => {
    const checkDiscordIntegration = async () => {
      try {
        // Ping the backend to see if a global token exists and grab the channels
        // ⚠️ Replace with your Render URL if testing in prod
        const response = await axios.get('https://tron-v3.onrender.com/api/admin/discord-status');
        
        if (response.data.isConnected && response.data.channels) {
            setIsDiscordConnected(true);
            setChannels(response.data.channels);
        }
      } catch (error) {
        console.log("Discord is not connected or failed to fetch channels.", error);
      } finally {
        setCheckingDiscord(false);
      }
    };

    checkDiscordIntegration();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    const payload = {
      orgId: formData.orgId,
      repoName: formData.repoName,
      pmProvider: formData.pmProvider,
      pmProjectId: formData.pmProjectId,
      mapping: {
        todo: formData.todoCol,
        branch_created: formData.branchCol,
        pull_request_opened: formData.prCol,
        pull_request_closed: formData.doneCol 
      },
      // 🌟 REFACTORED: We only pass the channel ID now, not the secret token!
      communication_config: isDiscordConnected && selectedChannel ? {
        provider: 'discord_bot',
        channel_id: selectedChannel
      } : null
    };

    try {
      // ⚠️ Replace with your Render URL if testing in prod
      const response = await axios.post('http://localhost:3000/api/repositories', payload);
      setStatus({ type: 'success', message: response.data.message });
      
      setFormData({ ...formData, repoName: '', pmProjectId: '', todoCol: '', branchCol: '', prCol: '', doneCol: '' });
      setSelectedChannel('');
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to link repository.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Repository Configuration</h1>
      <p className="text-gray-600 mb-8">
        Link a GitHub repository to your Project Management tool and map your automation columns.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Org ID */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 123e4567-e89b..."
              value={formData.orgId}
              onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
            />
          </div>

          {/* Repo Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Repository</label>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., owner/repo-name"
              value={formData.repoName}
              onChange={(e) => setFormData({ ...formData, repoName: e.target.value })}
            />
          </div>

          {/* PM Tool & Project ID */}
          <div className="flex gap-4">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">PM Tool</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50"
                value={formData.pmProvider}
                onChange={(e) => setFormData({ ...formData, pmProvider: e.target.value })}
              >
                <option value="basecamp">Basecamp</option>
              </select>
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project / Board ID</label>
              <input
                type="text" required
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 1234567"
                value={formData.pmProjectId}
                onChange={(e) => setFormData({ ...formData, pmProjectId: e.target.value })}
              />
            </div>
          </div>
        </div>

        <hr className="my-6 border-gray-200" />
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Automation Mapping</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* To-Do */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">&quot;To-Do&quot; Column ID</label>
            <p className="text-xs text-gray-500 mb-2">Default starting column.</p>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., col_11111"
              value={formData.todoCol}
              onChange={(e) => setFormData({ ...formData, todoCol: e.target.value })}
            />
          </div>

          {/* In Progress */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">&quot;In Progress&quot; Column ID</label>
            <p className="text-xs text-gray-500 mb-2">Moves ticket here when a branch is created.</p>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., col_98765"
              value={formData.branchCol}
              onChange={(e) => setFormData({ ...formData, branchCol: e.target.value })}
            />
          </div>

          {/* In Review */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">&quot;In Review&quot; Column ID</label>
            <p className="text-xs text-gray-500 mb-2">Moves ticket here when a PR is opened.</p>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., col_43210"
              value={formData.prCol}
              onChange={(e) => setFormData({ ...formData, prCol: e.target.value })}
            />
          </div>

          {/* Done */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">&quot;Done&quot; Column ID</label>
            <p className="text-xs text-gray-500 mb-2">Moves ticket here when a PR is closed/merged.</p>
            <input
              type="text" required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., col_99999"
              value={formData.doneCol}
              onChange={(e) => setFormData({ ...formData, doneCol: e.target.value })}
            />
          </div>
        </div>

        {/* 🌟 REFACTORED: Discord Broadcast Section */}
        <hr className="my-6 border-gray-200" />
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🎮</span> Broadcast Configuration
        </h3>
        
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
            {checkingDiscord ? (
                 <div className="text-sm text-gray-500 animate-pulse">Checking Discord integration status...</div>
            ) : isDiscordConnected ? (
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Discord Channel</label>
                    <select 
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                    >
                        <option value="">-- Choose a channel --</option>
                        {channels.map(channel => (
                            <option key={channel.id} value={channel.id}># {channel.name}</option>
                        ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-2">AI PR Summaries and alerts will be posted here.</p>
                </div>
            ) : (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex flex-col sm:flex-row justify-between items-center">
                    <span className="text-sm text-indigo-800 font-medium mb-3 sm:mb-0">Broadcasts disabled. Discord is not connected.</span>
                    <button 
                        type="button"
                        onClick={() => router.push('/integrations')}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition-colors"
                    >
                        Connect Discord
                    </button>
                </div>
            )}
        </div>

        {status.message && (
          <div className={`p-4 rounded-md ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4 text-lg"
        >
          {loading ? 'Saving...' : 'Link Repository'}
        </button>
      </form>
    </div>
  );
}