const express = require('express');
const { supabase } = require('../config/supabase.js');

const router = express.Router();

/**
 * POST /api/integrations/setup
 * Payload: { orgId: 'uuid', provider: 'github' | 'basecamp', token: '...' }
 */
router.post('/setup', async (req, res) => {
    const { orgId, provider, token } = req.body;

    if (!orgId || !provider || !token) {
        return res.status(400).json({ error: 'Missing orgId, provider, or token' });
    }

    try {
        const { data: secretId, error } = await supabase.rpc('store_integration_token', {
            p_org_id: orgId,
            p_provider: provider,
            p_token: token
        });

        if (error) throw error;

        return res.status(200).json({
            message: `${provider} integration secured successfully.`,
            integration_id: secretId
        });
    } catch (error) {
        console.error(`[Integrations] Failed to setup ${provider}:`, error.message);
        return res.status(500).json({ error: 'Failed to secure integration token' });
    }
});

module.exports = router;