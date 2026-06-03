package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
)

type BasecampCredentials struct {
	SecretID     string
	AccountID    string `json:"accountId"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

type BasecampAdapter struct {
	HTTPClient *http.Client
}

func NewBasecampAdapter() *BasecampAdapter {
	return &BasecampAdapter{
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// ==========================================
// 🌟 V3: SUPABASE VAULT INTEGRATION
// ==========================================
func (api *BasecampAdapter) getCredentials(orgID string) (BasecampCredentials, error) {
	var integration models.Integration
	result := database.DB.Where("provider = ? AND org_id = ?", "basecamp", orgID).
		Order("created_at desc").First(&integration)

	if result.Error != nil || integration.SecretID == nil {
		return BasecampCredentials{}, fmt.Errorf("Basecamp is not connected for Org: %s", orgID)
	}

	decryptedJson, err := services.GetDecryptedSecret(*integration.SecretID)
	if err != nil {
		return BasecampCredentials{}, err
	}

	var creds BasecampCredentials
	json.Unmarshal([]byte(decryptedJson), &creds)
	creds.SecretID = *integration.SecretID
	return creds, nil
}

// ==========================================
// 🌟 V3: SECURE TOKEN REFRESH FLOW
// ==========================================
func (api *BasecampAdapter) refreshBasecampToken(orgID string, currentCreds BasecampCredentials) (string, error) {
	fmt.Printf("\n🔄 [BASECAMP] Token expired for Org [%s]. Attempting V3 refresh...\n", orgID)

	redirectURI := url.QueryEscape("https://tron-v3.onrender.com/api/auth/basecamp/callback")
	refreshURL := fmt.Sprintf("https://launchpad.37signals.com/authorization/token?type=refresh&refresh_token=%s&client_id=%s&redirect_uri=%s&client_secret=%s",
		currentCreds.RefreshToken, currentCreds.ClientID, redirectURI, currentCreds.ClientSecret)

	resp, err := api.HTTPClient.Post(refreshURL, "application/json", nil)
	if err != nil || resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("this Basecamp ID rekeyed its deadbolt. User must re-authenticate")
	}
	defer resp.Body.Close()

	var tokens struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	json.NewDecoder(resp.Body).Decode(&tokens)

	if tokens.RefreshToken != "" {
		currentCreds.RefreshToken = tokens.RefreshToken
	}

	finalPayload, _ := json.Marshal(map[string]string{
		"accountId":    currentCreds.AccountID,
		"clientId":     currentCreds.ClientID,
		"clientSecret": currentCreds.ClientSecret,
		"accessToken":  tokens.AccessToken,
		"refreshToken": currentCreds.RefreshToken,
	})

	secretName := fmt.Sprintf("basecamp_active_%s_%d", orgID, time.Now().Unix())
	newSecretID, err := services.InsertSecret(secretName, "Refreshed OAuth keys for Basecamp", string(finalPayload))
	if err != nil {
		return "", err
	}

	database.DB.Model(&models.Integration{}).
		Where("provider = ? AND org_id = ?", "basecamp", orgID).
		Update("secret_id", newSecretID)

	services.DeleteSecret(currentCreds.SecretID)

	fmt.Printf("✅ [BASECAMP] Token refresh complete! Vault updated for Org [%s].\n", orgID)
	return tokens.AccessToken, nil
}

// ==========================================
// 🌟 THE IMMUNE SYSTEM (Self-Healing Wrapper)
// ==========================================
type apiAction func(creds BasecampCredentials) (*http.Response, error)

func (api *BasecampAdapter) executeWithRetry(orgID string, action apiAction) ([]byte, error) {
	creds, err := api.getCredentials(orgID)
	if err != nil {
		return nil, err
	}

	resp, err := action(creds)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode == http.StatusUnauthorized {
		fmt.Println("⚠️ [BASECAMP] Caught 401 Unauthorized. Triggering self-healing flow...")
		resp.Body.Close()

		freshToken, err := api.refreshBasecampToken(orgID, creds)
		if err != nil {
			return nil, err
		}

		creds.AccessToken = freshToken
		fmt.Println("♻️ [BASECAMP] Retrying API call with newly minted token...")

		resp, err = action(creds)
		if err != nil {
			return nil, err
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		errMsg := string(bodyBytes)
		fmt.Printf("❌ [BASECAMP API REJECTED] Status: %d | Response: %s\n", resp.StatusCode, errMsg)
		return nil, fmt.Errorf("basecamp API error: %d, %s", resp.StatusCode, errMsg)
	}

	return io.ReadAll(resp.Body)
}

func (api *BasecampAdapter) makeRequest(method, url string, creds BasecampCredentials, payload interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		bodyReader = bytes.NewBuffer(b)
	}

	req, _ := http.NewRequest(method, url, bodyReader)
	req.Header.Set("Authorization", "Bearer "+creds.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "TRON-V3-Engine (admin@tron.local)")

	return api.HTTPClient.Do(req)
}

// ==========================================
// 1. Fetch Active Tasks
// ==========================================
func (api *BasecampAdapter) FetchActiveTasks(projectID, columnID, orgID string) ([]map[string]interface{}, error) {
	responseBytes, err := api.executeWithRetry(orgID, func(creds BasecampCredentials) (*http.Response, error) {
		url := fmt.Sprintf("https://3.basecampapi.com/%s/buckets/%s/card_tables/lists/%s/cards.json", creds.AccountID, projectID, columnID)
		return api.makeRequest("GET", url, creds, nil)
	})

	if err != nil {
		return nil, err
	}

	var cards []map[string]interface{}
	json.Unmarshal(responseBytes, &cards)
	return cards, nil
}

// ==========================================
// 2. Resolve Task (Returns ID and EXACT URL)
// ==========================================
// We changed the return type to (string, string, error) -> (id, url, error)
func (api *BasecampAdapter) ResolveTask(projectID, todoColumnID, taskName, orgID string) (string, string, error) {
	trimmedTask := strings.TrimSpace(taskName)

	existingTasks, err := api.FetchActiveTasks(projectID, todoColumnID, orgID)
	if err == nil {
		for _, t := range existingTasks {
			if title, ok := t["title"].(string); ok {
				if strings.EqualFold(strings.TrimSpace(title), trimmedTask) {
					// 🌟 THE FIX: Grab the exact 'url' property directly from Basecamp's response!
					exactUrl, _ := t["url"].(string)
					return fmt.Sprintf("%v", t["id"]), exactUrl, nil
				}
			}
		}
	}

	fmt.Printf("✨ [BASECAMP] Creating new task: \"%s\"\n", trimmedTask)
	payload := map[string]string{
		"title":   trimmedTask,
		"content": "Created by T.R.O.N. V3",
	}

	respBytes, err := api.executeWithRetry(orgID, func(creds BasecampCredentials) (*http.Response, error) {
		url := fmt.Sprintf("https://3.basecampapi.com/%s/buckets/%s/card_tables/lists/%s/cards.json", creds.AccountID, projectID, todoColumnID)
		return api.makeRequest("POST", url, creds, payload)
	})

	if err != nil {
		return "", "", err
	}

	var result map[string]interface{}
	json.Unmarshal(respBytes, &result)
	exactUrl, _ := result["url"].(string)
	return fmt.Sprintf("%v", result["id"]), exactUrl, nil
}

// ==========================================
// 3. Move Ticket (Using Basecamp's Provided URL)
// ==========================================
func (api *BasecampAdapter) UpdateTicketStatus(exactCardUrl, newColumnID, projectID, orgID string) error {
	cleanColumnID, _ := strconv.ParseInt(strings.TrimSpace(newColumnID), 10, 64)

	// If we don't have the exact URL, fallback to the standard recording URL
	if exactCardUrl == "" {
		fmt.Printf("⚠️ [BASECAMP] No exact URL provided. Ticket move aborted.\n")
		return fmt.Errorf("missing exact card URL")
	}

	// 🌟 THE FIX: Append /moves.json to the exact URL Basecamp gave us
	moveUrl := strings.Replace(exactCardUrl, ".json", "/moves.json", 1)

	_, err := api.executeWithRetry(orgID, func(creds BasecampCredentials) (*http.Response, error) {
		payload := map[string]interface{}{"column_id": cleanColumnID}
		return api.makeRequest("POST", moveUrl, creds, payload)
	})

	if err == nil {
		fmt.Printf("✅ [BASECAMP] Moved ticket to column [%s]\n", newColumnID)
	} else {
		fmt.Printf("❌ [BASECAMP] Ticket move failed: %v\n", err)
	}
	return err
}

// ==========================================
// 4. Auto-Assign Developer (Using Basecamp's Provided URL)
// ==========================================
func (api *BasecampAdapter) AssignDeveloper(exactCardUrl, developerName, orgID string) error {
	if exactCardUrl == "" {
		return fmt.Errorf("missing exact card URL")
	}

	peopleBytes, err := api.executeWithRetry(orgID, func(creds BasecampCredentials) (*http.Response, error) {
		// Note: We have to manually extract the Account ID from the exactCardUrl for the people fetch
		parts := strings.Split(exactCardUrl, "/")
		var accountId string
		if len(parts) > 3 {
			accountId = parts[3]
		}

		url := fmt.Sprintf("https://3.basecampapi.com/%s/people.json", accountId)
		return api.makeRequest("GET", url, creds, nil)
	})

	if err != nil {
		fmt.Printf("❌ [BASECAMP] Failed to fetch people: %v\n", err)
		return err
	}

	var people []map[string]interface{}
	json.Unmarshal(peopleBytes, &people)

	alphanumericRe := regexp.MustCompile(`[^a-z0-9]`)
	normalizedDev := alphanumericRe.ReplaceAllString(strings.ToLower(developerName), "")

	var assigneeID interface{}
	var assigneeName string

	for _, person := range people {
		name, _ := person["name"].(string)
		email, _ := person["email_address"].(string)

		normName := alphanumericRe.ReplaceAllString(strings.ToLower(name), "")
		normEmail := ""
		if parts := strings.Split(email, "@"); len(parts) > 0 {
			normEmail = alphanumericRe.ReplaceAllString(strings.ToLower(parts[0]), "")
		}

		if strings.Contains(normName, normalizedDev) || strings.Contains(normalizedDev, normName) || strings.Contains(normEmail, normalizedDev) {
			assigneeID = person["id"]
			assigneeName = name
			break
		}
	}

	if assigneeID == nil {
		fmt.Printf("⚠️ [BASECAMP] Could not find Basecamp user matching Git name: \"%s\". Skipping assignment.\n", developerName)
		return nil
	}

	var finalAssigneeID int64
	switch v := assigneeID.(type) {
	case float64:
		finalAssigneeID = int64(v)
	case int:
		finalAssigneeID = int64(v)
	case string:
		finalAssigneeID, _ = strconv.ParseInt(v, 10, 64)
	}

	_, err = api.executeWithRetry(orgID, func(creds BasecampCredentials) (*http.Response, error) {
		// 🌟 THE FIX: We use the EXACT URL provided by Basecamp! No guessing required.
		payload := map[string]interface{}{
			"assignee_ids": []int64{finalAssigneeID},
		}
		return api.makeRequest("PUT", exactCardUrl, creds, payload)
	})

	if err == nil {
		fmt.Printf("✅ [BASECAMP] Automatically assigned ticket to %s\n", assigneeName)
	} else {
		fmt.Printf("❌ [BASECAMP] Developer assignment failed: %v\n", err)
	}
	return err
}
