// src/adapters/pm-orchestrator.js
const BasecampAdapter = require('./basecamp');
const JiraAdapter = require('./jira');
const MondayAdapter = require('./monday');

class PMOrchestrator {
    
    static async getTickets(pmConfig = {}, mapping = {}) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        try {
            if (provider === 'basecamp') {
                // 🌟 FIX: Updated to V3 database key 'todo'
                const todoTasks = mapping.todo 
                    ? await BasecampAdapter.fetchActiveTasks(projectId, mapping.todo) 
                    : [];
                
                const inProgressTasks = mapping.branch_created 
                    ? await BasecampAdapter.fetchActiveTasks(projectId, mapping.branch_created) 
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

    static async updateTicketStatus(pmConfig = {}, ticketId, newStatusID) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        if (!newStatusID) {
            console.log(`⏭️ [ORCHESTRATOR] Skipping update: No destination column ID provided.`);
            return;
        }

        try {
            if (provider === 'basecamp') {
                await BasecampAdapter.updateTicketStatus(ticketId, newStatusID, projectId); 
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

    static async resolveTask(pmConfig = {}, taskName, mapping = {}) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        const fallbackId = taskName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

        try {
            if (provider === 'basecamp') {
                // 🌟 FIX: Updated to V3 database key 'todo'
                return await BasecampAdapter.resolveTask(projectId, mapping.todo, taskName);
            } else if (provider === 'jira' || provider === 'monday') {
                return fallbackId; 
            }
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to resolve task for ${provider}:`, error.message);
        }
        
        return fallbackId;
    }

    static async assignTicket(pmConfig = {}, ticketId, developer) {
        const provider = pmConfig.provider || pmConfig.pm_provider || 'none';
        const projectId = pmConfig.project_id || pmConfig.pm_project_id || pmConfig.board_id;
        
        // If the extension failed to get a git username, it defaults to 'dev'. Skip in this case.
        if (!developer || developer === 'dev') return; 

        try {
            if (provider === 'basecamp') {
                await BasecampAdapter.assignDeveloper(projectId, ticketId, developer); 
            }
            // (You can add Jira/Monday assignment logic here in the future)
        } catch (error) {
            console.error(`❌ [ORCHESTRATOR] Failed to assign ticket for ${provider}:`, error.message);
        }
    }
}

module.exports = PMOrchestrator;