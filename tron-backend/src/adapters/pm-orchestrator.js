// src/adapters/pm-orchestrator.js
const BasecampAdapter = require('./basecamp');
const JiraAdapter = require('./jira');
const MondayAdapter = require('./monday');

class PMOrchestrator {
    
    static async getTickets(pmConfig = {}, mapping = {}, orgId) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        console.log(`🔍 [ORCHESTRATOR DEBUG] Received mapping:`, JSON.stringify(mapping, null, 2));
        
        try {
            if (provider === 'basecamp') {
                if (!orgId) throw new Error("Missing orgId for Basecamp request.");
                
                const actualMapping = mapping.mapping ? mapping.mapping : mapping;
                
                const todoTasks = actualMapping.todo 
                    ? await BasecampAdapter.fetchActiveTasks(projectId, actualMapping.todo, orgId) 
                    : [];
                
                const inProgressCol = actualMapping.branch_created || actualMapping.in_progress;
                
                console.log(`🔍 [ORCHESTRATOR] Fetching In-Progress tasks from column: ${inProgressCol}`);

                const inProgressTasks = inProgressCol 
                    ? await BasecampAdapter.fetchActiveTasks(projectId, inProgressCol, orgId) 
                    : [];
                
                return [
                    ...todoTasks.map(t => ({ ...t, state: 'To Do' })),
                    ...inProgressTasks.map(t => ({ ...t, state: 'In Progress' }))
                ];
            } else if (provider === 'jira') {
                return await JiraAdapter.fetchActiveTasks(pmConfig.project_key);
            } else if (provider === 'monday') { 
                return await MondayAdapter.fetchActiveTasks(projectId);
            }
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to fetch tickets for ${provider}:`, error.message);
        }
        return [];
    }

    static async updateTicketStatus(pmConfig = {}, ticketId, newStatusID, orgId) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        if (!newStatusID) {
            console.log(`⏭️ [ORCHESTRATOR] Skipping update: No destination column ID provided.`);
            return;
        }

        try {
            if (provider === 'basecamp') {
                if (!orgId) throw new Error("Missing orgId for Basecamp request.");
                await BasecampAdapter.updateTicketStatus(ticketId, newStatusID, projectId, orgId); 
            } else if (provider === 'jira') {
                await JiraAdapter.updateTicketStatus(ticketId, newStatusID);
            } else if (provider === 'monday') { 
                await MondayAdapter.updateTicketStatus(ticketId, newStatusID, projectId);
            }
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to update status for ${provider}:`, error.message);
            throw error; 
        }
    }

    static async resolveTask(pmConfig = {}, taskName, mapping = {}, orgId) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        const fallbackId = taskName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        try {
            if (provider === 'basecamp') {
                if (!orgId) throw new Error("Missing orgId for Basecamp request.");
                
                const actualMapping = mapping.mapping ? mapping.mapping : mapping;
                return await BasecampAdapter.resolveTask(projectId, actualMapping.todo, taskName, orgId);
            } else if (provider === 'jira' || provider === 'monday') {
                return fallbackId; 
            }
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to resolve task for ${provider}:`, error.message);
        }
        
        return fallbackId;
    }

    static async assignTicket(pmConfig = {}, ticketId, developer, orgId) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        // 🌟 THE FIX: Removed the hardcoded 'dev' check.
        // We only abort if the developer string is completely missing or empty.
        if (!developer || String(developer).trim() === '') {
            console.log(`⏭️ [ORCHESTRATOR] Skipping assignment: No developer provided.`);
            return; 
        }

        try {
            if (provider === 'basecamp') {
                if (!orgId) throw new Error("Missing orgId for Basecamp request.");
                
                // We now hand the raw string off to the BasecampAdapter,
                // which is responsible for matching the string to an actual Basecamp Member ID.
                await BasecampAdapter.assignDeveloper(projectId, ticketId, developer, orgId); 
            }
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to assign ticket for ${provider}:`, error.message);
        }
    }
}

module.exports = PMOrchestrator;