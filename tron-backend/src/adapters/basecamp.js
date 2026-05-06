// src/adapters/basecamp.js
const axios = require('axios');
const { supabase } = require('../config/supabase');

class BasecampAdapter {
    // ==========================================
    // 🌟 V3: SUPABASE VAULT INTEGRATION
    // ==========================================
    static async getCredentials(orgId) {
        if (!orgId) throw new Error("Missing orgId for Basecamp query.");

        // 1. Get the most recent active Basecamp integration for this Org
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('secret_id')
            .eq('provider', 'basecamp')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false }) // 🔥 Always grab the freshest token
            .limit(1)
            .single();

        if (intError || !integration || !integration.secret_id) {
            throw new Error(`Basecamp is not connected for Org: ${orgId}`);
        }

        // 2. Decrypt the secret payload via Supabase RPC
        const { data: decryptedJson, error: secError } = await supabase.rpc('get_decrypted_secret', {
            p_secret_id: integration.secret_id
        });

        if (secError || !decryptedJson) {
            throw new Error(`Failed to decrypt Basecamp token for Org: ${orgId}`);
        }

        const credentials = JSON.parse(decryptedJson);
        return {
            secretId: integration.secret_id, // Keep track of the old ID so we can rotate it if needed
            accountId: credentials.accountId || credentials.account_id,
            accessToken: credentials.accessToken || credentials.access_token,
            refreshToken: credentials.refreshToken || credentials.refresh_token,
            clientId: credentials.clientId || credentials.client_id,
            clientSecret: credentials.clientSecret || credentials.client_secret
        };
    }

    static getBaseConfig(accessToken) {
        return {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'TRON-V3-Engine (admin@tron.local)'
            }
        };
    }

    static getBaseUrl(accountId, projectId) {
        return `https://3.basecampapi.com/${accountId}/projects/${projectId}`;
    }

    // ==========================================
    // 🌟 V3: SECURE TOKEN REFRESH FLOW
    // ==========================================
    static async refreshBasecampToken(orgId, currentCreds) {
        console.log(`\n🔄 [BASECAMP] Token expired for Org [${orgId}]. Attempting V3 refresh...`);
        
        try {
            const redirectUri = encodeURIComponent("https://tron-v3.onrender.com/api/auth/basecamp/callback");
            const refreshUrl = `https://launchpad.37signals.com/authorization/token?type=refresh&refresh_token=${currentCreds.refreshToken}&client_id=${currentCreds.clientId}&redirect_uri=${redirectUri}&client_secret=${currentCreds.clientSecret}`;

            // 1. Hit 37signals to rotate the tokens
            const response = await axios.post(refreshUrl);
            const newAccessToken = response.data.access_token;
            const newRefreshToken = response.data.refresh_token; // 37signals often returns a new refresh token too!

            console.log('✅ [BASECAMP] 37signals provided fresh tokens. Saving to Vault...');

            // 2. Create the new secure payload
            const finalCredentials = JSON.stringify({
                accountId: currentCreds.accountId, 
                clientId: currentCreds.clientId, 
                clientSecret: currentCreds.clientSecret,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken || currentCreds.refreshToken
            });

            // 3. Insert the new token into the Vault
            const { data: newSecretId, error: vaultError } = await supabase.rpc('insert_secret', {
                secret_name: `basecamp_active_${orgId}_${Date.now()}`,
                secret_description: `Refreshed OAuth keys for Basecamp`,
                secret_value: finalCredentials
            });

            if (vaultError || !newSecretId) throw new Error(`Vault Error: ${vaultError?.message}`);

            // 4. Update the Integrations table to point to the new Secret ID
            const { error: upsertError } = await supabase
                .from('integrations')
                .upsert({ 
                    provider: 'basecamp', 
                    secret_id: newSecretId, 
                    org_id: orgId 
                }, { onConflict: 'org_id, provider' }); 

            if (upsertError) throw new Error(`DB Upsert Error: ${upsertError.message}`);

            // 5. Cleanup the old token to prevent vault bloat
            await supabase.rpc('delete_secret', { p_secret_id: currentCreds.secretId }).catch(() => {});

            console.log(`✅ [BASECAMP] Token refresh complete! Vault updated for Org [${orgId}].`);
            
            // Return the fresh token so the paused request can resume
            return newAccessToken;

        } catch (error) {
            console.error("❌ [BASECAMP] Fatal Refresh Error. The deadbolt is permanently locked. User must re-authenticate in dashboard.");
            throw new Error("This Basecamp ID rekeyed its deadbolt.");
        }
    }

    // ==========================================
    // 🌟 THE IMMUNE SYSTEM (Self-Healing Wrapper)
    // ==========================================
    static async executeWithRetry(orgId, apiCallCallback) {
        try {
            // 1. Always fetch the freshest credentials from the Vault first
            const creds = await this.getCredentials(orgId);
            
            // 2. Attempt the API call
            return await apiCallCallback(creds);
        } catch (error) {
            // 3. If the token is expired (401), intercept it before failing!
            if (error.response && error.response.status === 401) {
                console.log('⚠️ [BASECAMP] Caught 401 Unauthorized. Triggering self-healing flow...');
                
                // Get the broken creds to use for the refresh attempt
                const staleCreds = await this.getCredentials(orgId);

                // Rotate the tokens securely via Supabase
                const freshAccessToken = await this.refreshBasecampToken(orgId, staleCreds);
                
                // Construct a fresh credentials object
                const refreshedCreds = { ...staleCreds, accessToken: freshAccessToken };

                console.log('♻️ [BASECAMP] Retrying API call with newly minted token...');
                return await apiCallCallback(refreshedCreds);
            }
            
            throw error;
        }
    }

    // ==========================================
    // 1. Fetch Active Tasks
    // ==========================================
    static async fetchActiveTasks(projectId, columnId, orgId) {
        if (!columnId || columnId === 'undefined') {
            console.error('❌ [BASECAMP] Column ID is undefined. Check your mapping.');
            return [];
        }

        try {
            const response = await this.executeWithRetry(orgId, (creds) => 
                axios.get(
                    `${this.getBaseUrl(creds.accountId, projectId)}/card_tables/lists/${columnId}/cards.json`,
                    this.getBaseConfig(creds.accessToken)
                )
            );

            return response.data.map(card => ({
                id: card.id.toString(),
                title: card.title,
                description: card.content || "No description provided." 
            }));
        } catch (error) {
            console.error(`❌ [BASECAMP] Fetch Tasks Error:`, error.message);
            return [];
        }
    }

    // ==========================================
    // 2. Resolve Task
    // ==========================================
    static async resolveTask(projectId, todoColumnId, taskName, orgId) {
        try {
            const trimmedTask = taskName.trim();
            const possibleId = trimmedTask.replace(/\D/g, ''); 

            if (possibleId.length >= 8) {
                return possibleId;
            }

            const existingTasks = await this.fetchActiveTasks(projectId, todoColumnId, orgId);
            const duplicate = existingTasks.find(t => t.title.trim().toLowerCase() === trimmedTask.toLowerCase());

            if (duplicate) {
                return duplicate.id;
            }

            console.log(`✨ [BASECAMP] Creating new task: "${trimmedTask}"`);
            
            const response = await this.executeWithRetry(orgId, (creds) => 
                axios.post(
                    `${this.getBaseUrl(creds.accountId, projectId)}/card_tables/lists/${todoColumnId}/cards.json`,
                    { title: trimmedTask, content: "Created by T.R.O.N. V3" },
                    this.getBaseConfig(creds.accessToken)
                )
            );

            return response.data.id.toString();
        } catch (error) {
            console.error(`❌ [BASECAMP] Create Task Error:`, error.message);
            throw error;
        }
    }

    // ==========================================
    // 3. Move Ticket
    // ==========================================
    static async updateTicketStatus(ticketId, newColumnId, projectId, orgId) {
        try {
            const cleanTicketId = ticketId.toString().replace(/\D/g, '');
            
            await this.executeWithRetry(orgId, (creds) => {
                const targetUrl = `${this.getBaseUrl(creds.accountId, projectId)}/card_tables/cards/${cleanTicketId}/moves.json`;
                return axios.post(
                    targetUrl,
                    { column_id: parseInt(newColumnId) },
                    this.getBaseConfig(creds.accessToken)
                );
            });
            
            console.log(`✅ [BASECAMP] Moved ticket [${cleanTicketId}] to column [${newColumnId}]`);
        } catch (error) {
            console.error(`❌ [BASECAMP] Move Task Error:`, error.message);
            throw error; 
        }
    }

    // ==========================================
    // 4. Auto-Assign Developer
    // ==========================================
    static async assignDeveloper(projectId, ticketId, developerName, orgId) {
        try {
            const cleanTicketId = ticketId.toString().replace(/\D/g, '');

            const peopleResponse = await this.executeWithRetry(orgId, (creds) => 
                axios.get(
                    `https://3.basecampapi.com/${creds.accountId}/people.json`,
                    this.getBaseConfig(creds.accessToken)
                )
            );

            const normalizedDev = developerName.toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const assignee = peopleResponse.data.find(person => {
                const normName = person.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const normEmail = person.email_address.toLowerCase().split('@')[0].replace(/[^a-z0-9]/g, '');
                
                return normName.includes(normalizedDev) || normalizedDev.includes(normName) || normEmail.includes(normalizedDev);
            });

            if (!assignee) {
                console.log(`⚠️ [BASECAMP] Could not find Basecamp user matching Git name: "${developerName}". Skipping assignment.`);
                return;
            }

            await this.executeWithRetry(orgId, (creds) => {
                const targetUrl = `${this.getBaseUrl(creds.accountId, projectId)}/card_tables/cards/${cleanTicketId}.json`;
                return axios.put(
                    targetUrl,
                    { assignee_ids: [assignee.id] },
                    this.getBaseConfig(creds.accessToken)
                );
            });
            
            console.log(`✅ [BASECAMP] Automatically assigned ticket [${cleanTicketId}] to ${assignee.name}`);
        } catch (error) {
            console.error(`❌ [BASECAMP] Assign Task Error:`, error.message);
        }
    }
}

module.exports = BasecampAdapter;