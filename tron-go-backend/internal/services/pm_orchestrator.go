package services

import (
	"fmt"
	"regexp"
	"strings"
)

// PMAdapter is the interface that breaks the import cycle.
type PMAdapter interface {
	FetchActiveTasks(projectID, columnID, orgID string) ([]map[string]interface{}, error)
	UpdateTicketStatus(exactUrl, newColumnID, projectID, orgID string) error
	ResolveTask(projectID, todoColumnID, taskName, orgID string) (string, string, error)
	AssignDeveloper(exactUrl, developerName, orgID string) error
}

type Ticket struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"`
}

type PMOrchestrator struct {
	Basecamp PMAdapter
}

func NewPMOrchestrator(basecamp PMAdapter) *PMOrchestrator {
	return &PMOrchestrator{
		Basecamp: basecamp,
	}
}

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
				// 🌟 THE FIX: Safely extract the ID without scientific notation!
				idStr := fmt.Sprintf("%v", t["id"])
				if fVal, ok := t["id"].(float64); ok {
					idStr = fmt.Sprintf("%.0f", fVal)
				}

				allTickets = append(allTickets, Ticket{
					ID:          idStr,
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
				// 🌟 THE FIX: Apply safe extraction here as well!
				idStr := fmt.Sprintf("%v", t["id"])
				if fVal, ok := t["id"].(float64); ok {
					idStr = fmt.Sprintf("%.0f", fVal)
				}

				allTickets = append(allTickets, Ticket{
					ID:          idStr,
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

func (orch *PMOrchestrator) UpdateTicketStatus(provider, projectID, exactUrl, newStatusID, orgID string) error {
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
		return orch.Basecamp.UpdateTicketStatus(exactUrl, newStatusID, projectID, orgID)
	}

	return nil
}

func (orch *PMOrchestrator) ResolveTask(provider, projectID, taskName, orgID string, mapping map[string]interface{}) (string, string) {
	provider = strings.ToLower(provider)
	re := regexp.MustCompile(`[^a-zA-Z0-9]`)
	fallbackID := strings.ToLower(re.ReplaceAllString(taskName, "-"))

	switch provider {
	case "basecamp":
		if orgID == "" {
			fmt.Println("❌ [ORCHESTRATOR] Missing orgId for Basecamp request.")
			return fallbackID, ""
		}
		todoCol := extractMappingValue(mapping, "todo")

		taskID, exactUrl, err := orch.Basecamp.ResolveTask(projectID, todoCol, taskName, orgID)
		if err == nil && taskID != "" {
			return taskID, exactUrl
		}

	case "jira", "monday":
		return fallbackID, ""
	}

	return fallbackID, ""
}

func (orch *PMOrchestrator) AssignTicket(provider, projectID, exactUrl, developer, orgID string) {
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
		orch.Basecamp.AssignDeveloper(exactUrl, developer, orgID)
	}
}
