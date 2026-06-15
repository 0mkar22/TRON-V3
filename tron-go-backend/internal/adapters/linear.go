package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/services"
)

// LinearAdapter handles all GraphQL communication with the Linear API
type LinearAdapter struct {
	APIKey string
	Client *http.Client
}

// NewLinearAdapter initializes the client securely
func NewLinearAdapter(apiKey string) *LinearAdapter {
	return &LinearAdapter{
		APIKey: apiKey,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ==========================================
// 1. CORE GRAPHQL ENGINE
// ==========================================

func (l *LinearAdapter) ExecuteGraphQL(query string, variables map[string]interface{}) (map[string]interface{}, error) {
	url := "https://api.linear.app/graphql"

	payload := map[string]interface{}{
		"query": query,
	}
	if variables != nil {
		payload["variables"] = variables
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal graphql payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", l.APIKey)

	res, err := l.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("linear network error: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("linear API rejected request (HTTP %d): %s", res.StatusCode, string(bodyBytes))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse linear response: %w", err)
	}

	if errors, ok := result["errors"]; ok {
		// Log the full error to help with debugging
		errorsJSON, _ := json.Marshal(errors)
		return nil, fmt.Errorf("graphql execution error: %s", string(errorsJSON))
	}

	if data, ok := result["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return nil, fmt.Errorf("unexpected response structure from linear")
}

// ==========================================
// 2. FETCH WORKFLOW STATES
// ==========================================

func (l *LinearAdapter) GetAvailableStates(teamKey string) ([]map[string]interface{}, error) {
	// 🌟 FIXED: Query 'teams' with a filter instead of 'team(key)'
	query := `
		query GetTeamStates($teamKey: String!) {
			teams(filter: { key: { eq: $teamKey } }) {
				nodes {
					states {
						nodes {
							id
							name
							type
						}
					}
				}
			}
		}
	`

	variables := map[string]interface{}{
		"teamKey": teamKey,
	}

	data, err := l.ExecuteGraphQL(query, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch states for team %s: %w", teamKey, err)
	}

	teams, ok := data["teams"].(map[string]interface{})
	if !ok || teams == nil {
		return nil, fmt.Errorf("could not parse teams block")
	}

	nodes, ok := teams["nodes"].([]interface{})
	if !ok || len(nodes) == 0 {
		return nil, fmt.Errorf("team '%s' not found", teamKey)
	}

	teamNode, ok := nodes[0].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid team node structure")
	}

	statesMap, ok := teamNode["states"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("could not parse states block")
	}

	stateNodes, ok := statesMap["nodes"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("could not parse states nodes")
	}

	var states []map[string]interface{}
	for _, n := range stateNodes {
		if state, isMap := n.(map[string]interface{}); isMap {
			states = append(states, state)
		}
	}

	return states, nil
}

// ==========================================
// 3. THE TRANSITION MUTATION
// ==========================================

func (l *LinearAdapter) TransitionIssue(ticketID string, stateID string) error {
	mutation := `
		mutation UpdateIssueState($id: String!, $stateId: String!) {
			issueUpdate(id: $id, input: { stateId: $stateId }) {
				success
				issue {
					identifier
					state {
						name
					}
				}
			}
		}
	`

	variables := map[string]interface{}{
		"id":      ticketID,
		"stateId": stateID,
	}

	data, err := l.ExecuteGraphQL(mutation, variables)
	if err != nil {
		return fmt.Errorf("mutation failed for ticket %s: %w", ticketID, err)
	}

	issueUpdate, ok := data["issueUpdate"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("unexpected response structure from issueUpdate mutation")
	}

	success, _ := issueUpdate["success"].(bool)
	if !success {
		return fmt.Errorf("linear refused to update the issue state (success: false)")
	}

	if issueDetails, ok := issueUpdate["issue"].(map[string]interface{}); ok {
		if stateObj, ok := issueDetails["state"].(map[string]interface{}); ok {
			stateName, _ := stateObj["name"].(string)
			fmt.Printf("🎯 [LINEAR] Successfully moved ticket %s to %s!\n", ticketID, stateName)
		}
	}

	return nil
}

// ==========================================
// 4. VS CODE: GET ACTIVE TICKETS (LINEAR)
// ==========================================

func (l *LinearAdapter) GetTickets(teamKey string) []services.Ticket {
	// 🌟 FIXED: Safely query issues by traversing through the filtered team
	query := `
		query GetActiveTickets($teamKey: String!) {
			teams(filter: { key: { eq: $teamKey } }) {
				nodes {
					issues(filter: { state: { type: { neq: "completed" } } }) {
						nodes {
							identifier
							title
							state {
								name
							}
						}
					}
				}
			}
		}
	`

	variables := map[string]interface{}{
		"teamKey": teamKey,
	}

	data, err := l.ExecuteGraphQL(query, variables)
	if err != nil {
		fmt.Printf("❌ [LINEAR API] Failed to fetch tickets: %v\n", err)
		return []services.Ticket{}
	}

	var tickets []services.Ticket

	teams, ok := data["teams"].(map[string]interface{})
	if !ok || teams == nil {
		return tickets
	}

	nodes, ok := teams["nodes"].([]interface{})
	if !ok || len(nodes) == 0 {
		return tickets
	}

	teamNode, ok := nodes[0].(map[string]interface{})
	if !ok {
		return tickets
	}

	if issues, ok := teamNode["issues"].(map[string]interface{}); ok {
		if issueNodes, ok := issues["nodes"].([]interface{}); ok {
			for _, n := range issueNodes {
				if issue, isMap := n.(map[string]interface{}); isMap {
					stateName := "Unknown"
					if stateObj, ok := issue["state"].(map[string]interface{}); ok {
						stateName, _ = stateObj["name"].(string)
					}

					tickets = append(tickets, services.Ticket{
						ID:    fmt.Sprintf("%v", issue["identifier"]),
						Title: fmt.Sprintf("%v", issue["title"]),
						State: stateName,
					})
				}
			}
		}
	}

	return tickets
}

// ==========================================
// 5. CREATE TICKET (LINEAR) - WITH AUTO-UUID
// ==========================================

func (l *LinearAdapter) CreateTicket(teamKeyOrID, title string) (string, error) {
	teamID := teamKeyOrID

	if len(teamKeyOrID) < 10 {
		fmt.Printf("🔍 [LINEAR] Translating Team Key '%s' to UUID...\n", teamKeyOrID)

		// 🌟 FIXED: Use teams filter for UUID discovery
		query := `
			query GetTeamId($key: String!) {
				teams(filter: { key: { eq: $key } }) {
					nodes {
						id
					}
				}
			}
		`
		vars := map[string]interface{}{"key": teamKeyOrID}
		data, err := l.ExecuteGraphQL(query, vars)
		if err == nil {
			if teams, ok := data["teams"].(map[string]interface{}); ok {
				if nodes, ok := teams["nodes"].([]interface{}); ok && len(nodes) > 0 {
					if teamNode, ok := nodes[0].(map[string]interface{}); ok {
						if id, ok := teamNode["id"].(string); ok {
							teamID = id
							fmt.Printf("✅ [LINEAR] Found UUID: %s\n", teamID)
						}
					}
				}
			}
		}
	}

	mutation := `
		mutation CreateIssue($teamId: String!, $title: String!) {
			issueCreate(input: { teamId: $teamId, title: $title }) {
				success
				issue {
					identifier
				}
			}
		}
	`

	variables := map[string]interface{}{
		"teamId": teamID,
		"title":  title,
	}

	data, err := l.ExecuteGraphQL(mutation, variables)
	if err != nil {
		return "", fmt.Errorf("linear creation mutation failed: %w", err)
	}

	issueCreate, ok := data["issueCreate"].(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("unexpected response structure from issueCreate")
	}

	success, _ := issueCreate["success"].(bool)
	if !success {
		return "", fmt.Errorf("linear refused to create the issue")
	}

	if issueDetails, ok := issueCreate["issue"].(map[string]interface{}); ok {
		identifier, _ := issueDetails["identifier"].(string)
		fmt.Printf("✅ [LINEAR] Successfully created new ticket: %s\n", identifier)
		return identifier, nil
	}

	return "", fmt.Errorf("could not extract identifier from new linear issue")
}
