package services

import (
	"fmt"
	"regexp"
	"strings"
)

// PMAdapter is the interface that breaks the import cycle.
// Any struct (like Basecamp, Jira, Monday) that implements these methods can be used.
type PMAdapter interface {
	FetchActiveTasks(projectID, columnID, orgID string) ([]map[string]interface{}, error)
	UpdateTicketStatus(ticketID, newColumnID, projectID, orgID string) error
	ResolveTask(projectID, todoColumnID, taskName, orgID string) (string, error)
	AssignDeveloper(projectID, ticketID, developerName, orgID string) error
}

// Ticket standardized format across all PM tools
type Ticket struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"`
}

// PMOrchestrator routes requests to the correct Project Management Adapter
type PMOrchestrator struct {
	Basecamp PMAdapter // We use the Interface here, not the concrete struct!
}

// NewPMOrchestrator initializes the router
func NewPMOrchestrator(basecamp PMAdapter) *PMOrchestrator {
	return &PMOrchestrator{
		Basecamp: basecamp,
	}
}

// helper to safely extract mapping values
func extractMappingValue(mapping map[string]interface{}, key string) string {
	if nested, ok := mapping["mapping"].(map[string]interface{}); ok {
		if val, exists := nested[key].(string); exists {
			return val
		}
	}
	if val, exists := mapping[key].(string); exists {
		return val
	}
	return ""
}

// GetTickets fetches all active tasks from the configured provider
func (orch *PMOrchestrator) GetTickets(provider, projectID, orgID string, mapping map[string]interface{}) []Ticket {
	provider = strings.ToLower(provider)
	var allTickets []Ticket

	fmt.Printf("🔍 [ORCHESTRATOR DEBUG] Routing GetTickets to provider: %s\n", provider)

	switch provider {
	case "basecamp":
		if orgID == "" {
			fmt.Println("❌ [ORCHESTRATOR] Missing orgId for Basecamp request.")
			return allTickets
		}

		todoCol := extractMappingValue(mapping, "todo")
		inProgressCol := extractMappingValue(mapping, "branch_created")
		if inProgressCol == "" {
			inProgressCol = extractMappingValue(mapping, "in_progress")
		}

		if todoCol != "" {
			tasks, _ := orch.Basecamp.FetchActiveTasks(projectID, todoCol, orgID)
			for _, t := range tasks {
				allTickets = append(allTickets, Ticket{
					ID:          fmt.Sprintf("%v", t["id"]),
					Title:       fmt.Sprintf("%v", t["title"]),
					Description: fmt.Sprintf("%v", t["description"]),
					State:       "To Do",
				})
			}
		}

		if inProgressCol != "" {
			fmt.Printf("🔍 [ORCHESTRATOR] Fetching In-Progress tasks from column: %s\n", inProgressCol)
			tasks, _ := orch.Basecamp.FetchActiveTasks(projectID, inProgressCol, orgID)
			for _, t := range tasks {
				allTickets = append(allTickets, Ticket{
					ID:          fmt.Sprintf("%v", t["id"]),
					Title:       fmt.Sprintf("%v", t["title"]),
					Description: fmt.Sprintf("%v", t["description"]),
					State:       "In Progress",
				})
			}
		}

	case "jira", "monday":
		// Phase 4 implementations
	}

	return allTickets
}

// UpdateTicketStatus moves a card between columns on the Kanban board
func (orch *PMOrchestrator) UpdateTicketStatus(provider, projectID, ticketID, newStatusID, orgID string) error {
	provider = strings.ToLower(provider)

	if newStatusID == "" {
		fmt.Println("⏭️ [ORCHESTRATOR] Skipping update: No destination column ID provided.")
		return nil
	}

	switch provider {
	case "basecamp":
		if orgID == "" {
			return fmt.Errorf("missing orgId for Basecamp request")
		}
		return orch.Basecamp.UpdateTicketStatus(ticketID, newStatusID, projectID, orgID)
	}

	return nil
}

// ResolveTask finds an existing task by name, or creates a new one
func (orch *PMOrchestrator) ResolveTask(provider, projectID, taskName, orgID string, mapping map[string]interface{}) string {
	provider = strings.ToLower(provider)
	re := regexp.MustCompile(`[^a-zA-Z0-9]`)
	fallbackID := strings.ToLower(re.ReplaceAllString(taskName, "-"))

	switch provider {
	case "basecamp":
		if orgID == "" {
			fmt.Println("❌ [ORCHESTRATOR] Missing orgId for Basecamp request.")
			return fallbackID
		}
		todoCol := extractMappingValue(mapping, "todo")

		taskID, err := orch.Basecamp.ResolveTask(projectID, todoCol, taskName, orgID)
		if err == nil && taskID != "" {
			return taskID
		}

	case "jira", "monday":
		return fallbackID
	}

	return fallbackID
}

// AssignTicket matches a GitHub committer name to a Project Management team member
func (orch *PMOrchestrator) AssignTicket(provider, projectID, ticketID, developer, orgID string) {
	provider = strings.ToLower(provider)

	if strings.TrimSpace(developer) == "" {
		fmt.Println("⏭️ [ORCHESTRATOR] Skipping assignment: No developer provided.")
		return
	}

	switch provider {
	case "basecamp":
		if orgID == "" {
			fmt.Println("❌ [ORCHESTRATOR] Missing orgId for Basecamp request.")
			return
		}
		orch.Basecamp.AssignDeveloper(projectID, ticketID, developer, orgID)
	}
}
