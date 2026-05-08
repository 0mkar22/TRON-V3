const { supabase } = require('./supabase');

async function getRepoConfigFromDB(repoFullName) {
    try {
        const { data: repoConfig, error: repoError } = await supabase
            .from('repositories')
            .select('*')
            .eq('repo_name', repoFullName)
            .single();

        if (repoError || !repoConfig) return null;

        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('org_id', repoConfig.org_id)
            .eq('provider', repoConfig.pm_provider)
            .single();

        let decryptedToken = null;

        if (integration && !intError) {
            const { data: secret } = await supabase
                .from('vault.decrypted_secrets')
                .select('decrypted_secret')
                .eq('id', integration.secret_id)
                .single();
            
            if (secret) decryptedToken = secret.decrypted_secret;
        }

        return {
            repo: repoConfig.repo_name,
            org_id: repoConfig.org_id, // 🌟 EXPOSED FOR THE WORKER
            pm_tool: {
                provider: repoConfig.pm_provider,
                project_id: repoConfig.pm_project_id,
                token: decryptedToken 
            },
            mapping: repoConfig.mapping || {},
            communication: repoConfig.communication_config || null
        };

    } catch (err) {
        console.error('❌ Database fetch failed:', err.message);
        return null;
    }
}

module.exports = { getRepoConfigFromDB };