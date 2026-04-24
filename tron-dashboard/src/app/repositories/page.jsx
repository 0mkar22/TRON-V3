"use client";

import { useState } from 'react';
import axios from 'axios';

export default function RepositoriesPage() {
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
  
  // 🌟 NEW: Discord Broadcast States
  const [discordToken, setDiscordToken] = useState('');
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [fetchingChannels, setFetchingChannels] = useState(false);

  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  // 🌟 NEW: Fetch channels from your backend
  const fetchDiscordChannels = async (e) => {
    e.preventDefault(); // Prevent the main form from submitting
    setFetchingChannels(true);
    try {
      const response = await axios.post('http://localhost:3000/api/discord/channels', { botToken: discordToken });
      setChannels(response.data.channels);
      if (response.data.channels.length > 0) {
        setSelectedChannel(response.data.channels[0].id); // Auto-select the first channel
      }
    } catch (error) {
      alert("Failed to fetch channels. Please check your bot token!");
    } finally {
      setFetchingChannels(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    // Format the mapping JSON for the backend worker
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
      // 🌟 NEW: Conditionally attach the Discord config if provided
      communication_config: discordToken && selectedChannel ? {
        provider: 'discord_bot',
        bot_token: discordToken,
        channel_id: selectedChannel
      } : null
    };

    try {
      const response = await axios.post('http://localhost:3000/api/repositories', payload);
      setStatus({ type: 'success', message: response.data.message });
      
      // Reset form on success
      setFormData({ ...formData, repoName: '', pmProjectId: '', todoCol: '', branchCol: '', prCol: '', doneCol: '' });
      setDiscordToken('');
      setChannels([]);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">"To-Do" Column ID</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">"In Progress" Column ID</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">"In Review" Column ID</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">"Done" Column ID</label>
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

        {/* 🌟 NEW: Discord Broadcast Section */}
        <hr className="my-6 border-gray-200" />
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Broadcast Configuration (Optional)</h3>
        
        <div className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discord Bot Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Paste your bot token..."
                value={discordToken}
                onChange={(e) => setDiscordToken(e.target.value)}
              />
              <button
                onClick={fetchDiscordChannels}
                disabled={fetchingChannels || !discordToken}
                className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {fetchingChannels ? 'Fetching...' : 'Get Channels'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Required to post AI summaries to your Discord server.</p>
          </div>

          {/* Only show the dropdown if we successfully fetched channels */}
          {channels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Broadcast Channel</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white focus:ring-blue-500 focus:border-blue-500"
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                {channels.map(channel => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </select>
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
          className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4"
        >
          {loading ? 'Saving...' : 'Link Repository'}
        </button>
      </form>
    </div>
  );
}