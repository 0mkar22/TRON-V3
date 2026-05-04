// ==========================================
// 🐙 GITHUB WEBHOOK LISTENER (CORE ENGINE)
// ==========================================
const express = require('express');
const router = express.Router();
// Make sure you have your supabase client imported here!
// const supabase = require('../path/to/supabase'); 

// The Grand Central Station for GitHub Events
router.post('/github', express.json(), async (req, res) => {
    // 1. Acknowledge GitHub immediately (don't keep them waiting!)
    res.status(200).send('Webhook received.');

    const eventType = req.headers['x-github-event'];
    const payload = req.body;

    console.log(`[GITHUB WEBHOOK] Received event: ${eventType}`);

    // We only care about Pull Requests for now
    if (eventType !== 'pull_request') {
        console.log('Ignoring non-PR event.');
        return;
    }

    const { action, pull_request, repository } = payload;

    // We only trigger workflows when a PR is freshly opened or reopened
    if (action !== 'opened' && action !== 'reopened') {
         console.log(`Ignoring PR action: ${action}`);
         return;
    }

    try {
        console.log(`🚀 Processing PR #${pull_request.number}: "${pull_request.title}" in ${repository.full_name}`);
        
        // --- 🚨 CRITICAL: HOW DO WE KNOW WHO THIS BELONGS TO? 🚨 ---
        // This is the hardest part of multi-tenant webhooks. GitHub doesn't know our 'org_id'.
        // It only knows the repository name (e.g., "Ellenox/tron-v3").
        //
        // Next Step: We need a database table that links "Ellenox/tron-v3" to your specific org_id!
        
        // TODO: The actual workflow logic goes here!
        // 1. Fetch the mapping for this repository.
        // 2. See what tools are enabled (Basecamp? Discord?).
        // 3. Fire the actions!

    } catch (error) {
        console.error("❌ Webhook Processing Error:", error.message);
    }
});

module.exports = router;
// If adding to main server.js, use: app.use('/api/webhooks', githubWebhookRouter);