package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/services" // 🌟 ADDED: Required for the Ticket struct
)

type JiraAdapter struct {
	BaseURL  string
	Email    string
	APIToken string
	Client   *http.Client
}

// NewJiraAdapter initializes the client with your Jira credentials
func NewJiraAdapter(baseURL, email, apiToken string) *JiraAdapter {
	return &JiraAdapter{
		BaseURL:  baseURL,
		Email:    email,
		APIToken: apiToken,
		Client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ExtractTicketID scans a branch name or PR title and pulls out the Jira ID (e.g., "TRON-123")
func ExtractTicketID(text string) string {
	re := regexp.MustCompile(`[A-Z]+-\d+`)
	return re.FindString(text)
}

func (j *JiraAdapter) setAuthHeaders(req *http.Request) {
	req.SetBasicAuth(j.Email, j.APIToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
}

// ==========================================
// 1. VS CODE: GET ACTIVE TICKETS
// ==========================================

// GetTickets fetches all active (non-Done) issues for a specific Jira Project Key
func (j *JiraAdapter) GetTickets(projectKey string) []services.Ticket {
	// 🌟 FIX 1: Strip any accidental trailing slashes from the BaseURL
	baseURL := strings.TrimSuffix(j.BaseURL, "/")

	// 🌟 FIX 2: Safely encode the JQL so Jira doesn't reject it
	jql := fmt.Sprintf("project='%s' AND statusCategory != Done", projectKey)
	encodedJQL := url.QueryEscape(jql)

	apiURL := fmt.Sprintf("%s/rest/api/3/search/jql?jql=%s", baseURL, encodedJQL)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		fmt.Printf("❌ [JIRA API] Failed to create request: %v\n", err)
		return []services.Ticket{}
	}

	j.setAuthHeaders(req)

	res, err := j.Client.Do(req)
	if err != nil {
		fmt.Printf("❌ [JIRA API] Failed to fetch tickets: %v\n", err)
		return []services.Ticket{}
	}
	defer res.Body.Close()

	// 🌟 FIX 3: Actually check the HTTP Status Code!
	if res.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(res.Body)
		fmt.Printf("❌ [JIRA API] HTTP %d: Jira rejected the request: %s\n", res.StatusCode, string(bodyBytes))
		return []services.Ticket{}
	}

	// Parse the Atlassian JSON response
	var result struct {
		Issues []struct {
			Key    string `json:"key"`
			Fields struct {
				Summary string `json:"summary"`
				Status  struct {
					Name string `json:"name"`
				} `json:"status"`
			} `json:"fields"`
		} `json:"issues"`
	}

	if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
		fmt.Printf("❌ [JIRA API] Failed to parse response: %v\n", err)
		return []services.Ticket{}
	}

	// Map Jira issues to your standard TRON Ticket struct
	var tickets []services.Ticket
	for _, issue := range result.Issues {
		tickets = append(tickets, services.Ticket{
			ID:    issue.Key,
			Title: issue.Fields.Summary,
			State: issue.Fields.Status.Name,
		})
	}

	return tickets
}

// ==========================================
// 2. FETCH AVAILABLE TRANSITIONS
// ==========================================

// GetAvailableTransitions asks Jira what state changes are allowed for this ticket
func (j *JiraAdapter) GetAvailableTransitions(ticketID string) ([]map[string]interface{}, error) {
	url := fmt.Sprintf("%s/rest/api/3/issue/%s/transitions", j.BaseURL, ticketID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	j.setAuthHeaders(req)

	resp, err := j.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to fetch transitions: %s", string(bodyBytes))
	}

	var result struct {
		Transitions []map[string]interface{} `json:"transitions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Transitions, nil
}

// ==========================================
// 3. THE TRANSITION MAPPER & MUTATION
// ==========================================

// TransitionTicket maps a GitHub action to a target Jira status, finds its ID, and moves it
func (j *JiraAdapter) TransitionTicket(ticketID string, githubAction string, isMerged bool) error {
	// 1. Determine the target Jira status name based on code progress
	targetStatus := ""
	switch githubAction {
	case "opened", "reopened":
		targetStatus = "In Review" // Or "Under Review" depending on your team's Jira board
	case "closed":
		if isMerged {
			targetStatus = "Done"
		} else {
			return nil // PR closed without merging, skip or handle separately
		}
	default:
		return nil // Irrelevant action, gracefully exit
	}

	// 2. Fetch the allowed transitions from Jira for this specific ticket
	transitions, err := j.GetAvailableTransitions(ticketID)
	if err != nil {
		return fmt.Errorf("error fetching active transitions: %w", err)
	}

	// 3. Scan the payload to find the matching transition ID
	transitionID := ""
	for _, t := range transitions {
		name, _ := t["name"].(string)
		if strings.EqualFold(name, targetStatus) {
			transitionID, _ = t["id"].(string)
			break
		}
	}

	if transitionID == "" {
		return fmt.Errorf("could not find a valid transition ID matching status: %s", targetStatus)
	}

	// 4. Send the execution payload back to Jira to change the ticket state
	url := fmt.Sprintf("%s/rest/api/3/issue/%s/transitions", j.BaseURL, ticketID)
	payload := map[string]interface{}{
		"transition": map[string]string{
			"id": transitionID,
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return err
	}
	j.setAuthHeaders(req)

	resp, err := j.Client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Jira returns 204 No Content on a completely successful transition
	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("jira rejected transition with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// TransitionIssue pushes a ticket into a new workflow state using a Transition ID
func (j *JiraAdapter) TransitionIssue(ticketID, transitionID string) error {
	url := fmt.Sprintf("%s/rest/api/3/issue/%s/transitions", j.BaseURL, ticketID)

	payload := map[string]interface{}{
		"transition": map[string]string{
			"id": transitionID,
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal transition payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create transition post request: %w", err)
	}
	j.setAuthHeaders(req)

	resp, err := j.Client.Do(req)
	if err != nil {
		return fmt.Errorf("jira network error on transition execution: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("jira failed to execute transition (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	log.Printf("🎯 [JIRA] Successfully transitioned ticket %s using Transition ID %s\n", ticketID, transitionID)
	return nil
}
