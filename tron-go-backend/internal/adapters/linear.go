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

// ExecuteGraphQL is the universal method for all Linear network calls.
// It accepts a raw GraphQL string and optional variables, fires it, and parses the response.
func (l *LinearAdapter) ExecuteGraphQL(query string, variables map[string]interface{}) (map[string]interface{}, error) {
	url := "https://api.linear.app/graphql"

	// 1. Construct the strictly-typed GraphQL payload
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

	// 2. Linear requires the API key directly in the Authorization header (no "Bearer" or "Basic" prefix needed for Personal API Keys)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", l.APIKey)

	// 3. Fire the request
	res, err := l.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("linear network error: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	// 4. Trap standard HTTP errors (e.g., 401 Unauthorized)
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("linear API rejected request (HTTP %d): %s", res.StatusCode, string(bodyBytes))
	}

	// 5. Parse the GraphQL JSON response
	var result map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to parse linear response: %w", err)
	}

	// 6. Trap GraphQL-specific errors (GraphQL returns 200 OK even if the query logic fails!)
	if errors, ok := result["errors"]; ok {
		return nil, fmt.Errorf("graphql execution error: %v", errors)
	}

	// 7. Extract and return just the pure "data" payload
	if data, ok := result["data"].(map[string]interface{}); ok {
		return data, nil
	}

	return nil, fmt.Errorf("unexpected response structure from linear")
}

// ==========================================
// 2. FETCH WORKFLOW STATES (UUID Discovery)
// ==========================================

// GetAvailableStates asks Linear for all the columns/states on a specific team's board.
// teamKey is the prefix of the tickets, e.g., "ENG" for "ENG-123"
func (l *LinearAdapter) GetAvailableStates(teamKey string) ([]map[string]interface{}, error) {

	// The precise GraphQL query to fetch the board's states
	query := `
		query GetTeamStates($teamKey: String!) {
			team(key: $teamKey) {
				states {
					nodes {
						id
						name
						type
					}
				}
			}
		}
	`

	variables := map[string]interface{}{
		"teamKey": teamKey,
	}

	// Hand off to our core execution engine
	data, err := l.ExecuteGraphQL(query, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch states for team %s: %w", teamKey, err)
	}

	// Navigate the nested GraphQL JSON response: data -> team -> states -> nodes
	team, ok := data["team"].(map[string]interface{})
	if !ok || team == nil {
		return nil, fmt.Errorf("team '%s' not found or has no states", teamKey)
	}

	statesMap, ok := team["states"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("could not parse states block")
	}

	nodes, ok := statesMap["nodes"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("could not parse states nodes")
	}

	// Extract the nodes into a clean Go slice
	var states []map[string]interface{}
	for _, n := range nodes {
		if state, isMap := n.(map[string]interface{}); isMap {
			states = append(states, state)
		}
	}

	return states, nil
}

// ==========================================
// 3. THE TRANSITION MUTATION
// ==========================================

// TransitionIssue moves a Linear ticket (e.g., "ENG-123") to a new state using a State UUID
func (l *LinearAdapter) TransitionIssue(ticketID string, stateID string) error {
	// The precise GraphQL mutation to update an issue's state
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

	// Note: Linear allows passing the human-readable identifier (ENG-123) directly into the 'id' field!
	variables := map[string]interface{}{
		"id":      ticketID,
		"stateId": stateID,
	}

	// Hand off to our core execution engine
	data, err := l.ExecuteGraphQL(mutation, variables)
	if err != nil {
		return fmt.Errorf("mutation failed for ticket %s: %w", ticketID, err)
	}

	// Navigate the response to verify Linear accepted the change
	issueUpdate, ok := data["issueUpdate"].(map[string]interface{})
	if !ok {
		return fmt.Errorf("unexpected response structure from issueUpdate mutation")
	}

	success, _ := issueUpdate["success"].(bool)
	if !success {
		return fmt.Errorf("linear refused to update the issue state (success: false)")
	}

	// Extract the new state name just so we can log it beautifully
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

// GetTickets fetches all active (non-completed) issues for a specific Linear Team
func (l *LinearAdapter) GetTickets(teamKey string) []services.Ticket {
	query := `
		query GetActiveTickets($teamKey: String!) {
			team(key: $teamKey) {
				issues(filter: { state: { type: { neq: "completed" } } }) {
					nodes {
						identifier
						title
						url
						state {
							name
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

	// Safely navigate the GraphQL response tree
	if team, ok := data["team"].(map[string]interface{}); ok && team != nil {
		if issues, ok := team["issues"].(map[string]interface{}); ok {
			if nodes, ok := issues["nodes"].([]interface{}); ok {
				for _, n := range nodes {
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
	}

	return tickets
}

// ==========================================
// 5. CREATE TICKET (LINEAR)
// ==========================================

// CreateTicket generates a brand new issue on the Linear board
func (l *LinearAdapter) CreateTicket(teamID, title string) (string, error) {
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
		"teamId": teamID, // Note: Linear creation requires the UUID, not the "ENG" key!
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
