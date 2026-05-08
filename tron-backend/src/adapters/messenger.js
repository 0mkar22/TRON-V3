const axios = require('axios');
const { supabase } = require('../config/supabase');

/**
 * Broadcasts the AI Executive Summary to the team's communication channel
 */
async function broadcastSummary(communicationConfig, prTitle, prUrl, report, orgId) { 
    if (!communicationConfig) return;

    const { provider, webhook_url, channel_id, bot_token } = communicationConfig;

    try {
        if (provider === 'discord') {
            if (!webhook_url) throw new Error("Missing webhook_url");
            await sendDiscord(webhook_url, prTitle, prUrl, report);
            
        } else if (provider === 'discord_bot') {
            if (!channel_id) throw new Error("Missing channel_id");
            if (!orgId) throw new Error("Missing orgId to fetch Discord token");

            // Fetch the bot token from the DB dynamically based on the Organization
            const { data: integration, error } = await supabase
                .from('integrations')
                .select('token, secret_id')
                .eq('org_id', orgId)
                .in('provider', ['discord', 'discord_bot'])
                .limit(1)
                .single();

            let actualBotToken = integration?.token || bot_token;

            // Secure Vault Fallback
            if (integration?.secret_id && !integration?.token) {
                const { data: decryptedJson } = await supabase.rpc('get_decrypted_secret', {
                    p_secret_id: integration.secret_id
                });
                if (decryptedJson) {
                    const creds = JSON.parse(decryptedJson);
                    actualBotToken = creds.botToken || creds.bot_token || creds.token || actualBotToken;
                }
            }

            if (!actualBotToken) throw new Error("Missing bot_token in database for this organization.");
            
            await sendDiscordBot(actualBotToken, channel_id, prTitle, prUrl, report);
            
        } else if (provider === 'slack') {
            if (!webhook_url) throw new Error("Missing webhook_url");
            await sendSlack(webhook_url, prTitle, prUrl, report);
            
        } else {
            console.warn(`⚠️  [Messenger] Unsupported communication provider: '${provider}'`);
        }
    } catch (error) {
        console.error(`❌ [Messenger] Failed to broadcast to ${provider}:`, error.message);
    }
}

// ==========================================
// 🌟 The Discord Bot API Route
// ==========================================
async function sendDiscordBot(botToken, channelId, prTitle, prUrl, report) {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const payload = {
        embeds: [{
            title: `🤖 T.R.O.N. Intel: ${prTitle}`,
            url: prUrl,
            color: 3447003, // TRON Blue
            fields: [
                { name: '🏷️ Category', value: report.intent || 'Unknown' },
                { name: '📝 Summary', value: report.executive_summary || 'No summary provided.' },
                { name: '🚀 Business Impact', value: report.business_impact || 'No impact analysis provided.' }
            ],
            footer: { text: 'TRON V3 AI Pipeline' },
            timestamp: new Date().toISOString()
        }]
    };

    await axios.post(url, payload, {
        headers: {
            'Authorization': `Bot ${botToken}`, 
            'Content-Type': 'application/json'
        }
    });
    
    console.log('✅ [Messenger] Successfully broadcasted AI Intel via Custom Discord Bot.');
}

// ==========================================
// LEGACY WEBHOOK ROUTES
// ==========================================
async function sendDiscord(webhookUrl, prTitle, prUrl, report) {
    const payload = {
        embeds: [{
            title: `🤖 T.R.O.N. Intel: ${prTitle}`,
            url: prUrl,
            color: 3447003, 
            fields: [
                { name: '🏷️ Category', value: report.intent || 'Unknown' },
                { name: '📝 Summary', value: report.executive_summary || 'No summary provided.' },
                { name: '🚀 Business Impact', value: report.business_impact || 'No impact analysis provided.' }
            ],
            footer: { text: 'TRON V3 AI Pipeline' },
            timestamp: new Date().toISOString()
        }]
    };

    await axios.post(webhookUrl, payload);
    console.log('✅ [Messenger] Successfully broadcasted AI Intel to Discord.');
}

async function sendSlack(webhookUrl, prTitle, prUrl, report) {
    const payload = {
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `🤖 T.R.O.N. Intel: ${prTitle}` }
            },
            {
                type: "section",
                text: { type: "mrkdwn", text: `*<${prUrl}|View Pull Request>*` }
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*🏷️ Category:*\n${report.intent || 'Unknown'}` },
                    { type: "mrkdwn", text: `*📝 Summary:*\n${report.executive_summary || 'No summary'}` },
                    { type: "mrkdwn", text: `*🚀 Business Impact:*\n${report.business_impact || 'No impact'}` }
                ]
            }
        ]
    };

    await axios.post(webhookUrl, payload);
    console.log('✅ [Messenger] Successfully broadcasted AI Intel to Slack.');
}

module.exports = {
    broadcastSummary
};