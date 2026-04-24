const { supabase } = require('./supabase');

/**
 * Fetches repository config and the decrypted PM token from Supabase
 */
async function getRepoConfigFromDB(repoFullName) {
    try {
        // 1. Fetch the repository configuration
        const { data: repoConfig, error: repoError } = await supabase
            .from('repositories')
            .select('*')
            .eq('repo_name', repoFullName)
            .single();

        if (repoError || !repoConfig) return null;

        // 2. Fetch the integration to get the secret_id
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('org_id', repoConfig.org_id)
            .eq('provider', repoConfig.pm_provider)
            .single();

        let decryptedToken = null;

        // 3. Extract the actual token from the Vault
        if (integration && !intError) {
            const { data: secret } = await supabase
                .from('vault.decrypted_secrets')
                .select('decrypted_secret')
                .eq('id', integration.secret_id)
                .single();
            
            if (secret) decryptedToken = secret.decrypted_secret;
        }

        // 4. Return it exactly how PMOrchestrator and worker.js expect it
        return {
            repo: repoConfig.repo_name,
            pm_tool: {
                provider: repoConfig.pm_provider,
                project_id: repoConfig.pm_project_id,
                token: decryptedToken 
            },
            mapping: repoConfig.mapping || {},
            // 🌟 THE FIX: Grab 'communication_config' from the DB!
            communication: repoConfig.communication_config || null
        };

    } catch (err) {
        console.error('❌ Database fetch failed:', err.message);
        return null;
    }
}

module.exports = { getRepoConfigFromDB };