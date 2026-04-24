const axios = require('axios');

/**
 * Broadcasts the AI Executive Summary to the team's communication channel
 */
async function broadcastSummary(communicationConfig, prTitle, prUrl, report) {
    if (!communicationConfig) return;

    // V3: Extract all possible keys from your database JSON
    const { provider, webhook_url, channel_id, bot_token } = communicationConfig;

    try {
        if (provider === 'discord') {
            if (!webhook_url) throw new Error("Missing webhook_url");
            await sendDiscord(webhook_url, prTitle, prUrl, report);
            
        } else if (provider === 'discord_bot') {
            // 🌟 NEW: Route for custom Discord Bot
            if (!channel_id) throw new Error("Missing channel_id");
            if (!bot_token) throw new Error("Missing bot_token");
            
            await sendDiscordBot(bot_token, channel_id, prTitle, prUrl, report);
            
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
// 🌟 NEW: The Discord Bot API Route
// ==========================================
async function sendDiscordBot(botToken, channelId, prTitle, prUrl, report) {
    // The official Discord REST API endpoint for sending messages
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
            'Authorization': `Bot ${botToken}`, // Uses the dynamic token from your dashboard!
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