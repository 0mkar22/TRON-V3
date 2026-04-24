"use client";

import { useState } from 'react';
import axios from 'axios';

export default function IntegrationsPage() {
  const [formData, setFormData] = useState({
    orgId: '',
    provider: 'basecamp',
    token: ''
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // Calling your Express Backend!
      const response = await axios.post('http://localhost:3000/api/integrations/setup', formData);
      
      setStatus({ 
        type: 'success', 
        message: response.data.message || 'Integration secured successfully!' 
      });
      setFormData({ ...formData, token: '' }); // Clear the token for security
    } catch (error) {
      setStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to setup integration.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-gray-100">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Setup PM Integration</h1>
      <p className="text-gray-600 mb-8">
        Securely encrypt and store your Project Management API tokens into the Supabase Vault.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID (UUID)</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
            value={formData.orgId}
            onChange={(e) => setFormData({ ...formData, orgId: e.target.value })}
          />
        </div>

        {/* Provider Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
            value={formData.provider}
            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
          >
            <option value="basecamp">Basecamp</option>
            <option value="github">GitHub</option>
            <option value="jira">Jira</option>
            <option value="linear">Linear</option>
          </select>
        </div>

        {/* Token Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
          <input
            type="password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
            placeholder="Paste your API token here..."
            value={formData.token}
            onChange={(e) => setFormData({ ...formData, token: e.target.value })}
          />
        </div>

        {/* Status Messages */}
        {status.message && (
          <div className={`p-4 rounded-md ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {status.message}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Encrypting & Saving...' : 'Secure Integration'}
        </button>
      </form>
    </div>
  );
}