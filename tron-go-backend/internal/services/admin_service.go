package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/githubauth"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
	"github.com/tron-v3.1/tron-go-backend/pkg/vault"
	"gorm.io/datatypes"
)

func FetchGitHubRepos(orgID string) ([]map[string]interface{}, error) {
	fmt.Printf("🔍 [GITHUB] Fetching repos for Org: %s\n", orgID)

	var integration models.Integration
	if err := database.DB.Where("org_id = ? AND provider = ?", orgID, "github").First(&integration).Error; err != nil {
		fmt.Printf("❌ [GITHUB] No github integration found in DB for Org: %s\n", orgID)
		return []map[string]interface{}{}, nil
	}

	installationID := integration.Token
	if installationID == "" && integration.SecretID != nil {
		fmt.Printf("🔍 [GITHUB] Token column empty, checking Vault (SecretID: %s)\n", *integration.SecretID)
		installationID, _ = vault.GetDecryptedSecret(*integration.SecretID)
	}

	if installationID == "" {
		fmt.Printf("❌ [GITHUB] Installation ID is completely empty!\n")
		return []map[string]interface{}{}, nil
	}

	fmt.Printf("✅ [GITHUB] Found Installation ID: %s. Generating App JWT...\n", installationID)

	token, err := githubauth.GetInstallationToken(installationID)
	if err != nil {
		fmt.Printf("❌ [GITHUB] Failed to generate Installation Token: %v\n", err)
		return nil, errors.New("failed to generate GitHub token")
	}

	fmt.Printf("✅ [GITHUB] Token Generated. Fetching Repositories from GitHub API...\n")

	req, _ := http.NewRequest("GET", "https://api.github.com/installation/repositories?per_page=100", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		if resp != nil {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("❌ [GITHUB] API Error (%d): %s\n", resp.StatusCode, string(bodyBytes))
			resp.Body.Close()
		}
		return []map[string]interface{}{}, nil
	}
	defer resp.Body.Close()

	var result struct {
		Repositories []map[string]interface{} `json:"repositories"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	var repos []map[string]interface{}
	for _, repo := range result.Repositories {
		repos = append(repos, map[string]interface{}{
			"id":        repo["id"],
			"name":      repo["name"],
			"full_name": repo["full_name"],
			"private":   repo["private"],
			"url":       repo["html_url"],
		})
	}

	fmt.Printf("🎉 [GITHUB] Successfully returning %d repositories!\n", len(repos))
	return repos, nil
}

func FetchDashboardWorkflows(orgID string) ([]models.Repository, error) {
	var workflows []models.Repository
	if err := database.DB.Where("org_id = ?", orgID).Find(&workflows).Error; err != nil {
		return []models.Repository{}, nil
	}
	return workflows, nil
}

func FetchSystemStatus() ([]map[string]interface{}, []map[string]interface{}, error) {
	ctx := context.Background()

	rawQueue, err := redis.Client.LRange(ctx, "tron:v3_secret_queue", 0, -1).Result()
	if err != nil {
		return nil, nil, errors.New("failed to fetch queue from Redis")
	}

	var parsedQueue []map[string]interface{}
	for _, item := range rawQueue {
		var job map[string]interface{}
		if err := json.Unmarshal([]byte(item), &job); err == nil {
			parsedQueue = append(parsedQueue, job)
		}
	}

	reviewKeys, _ := redis.Client.Keys(ctx, "ai:review:*").Result()
	var activeReviews []map[string]interface{}

	for _, key := range reviewKeys {
		rawReview, _ := redis.Client.Get(ctx, key).Result()
		var parsedReview map[string]interface{}
		if err := json.Unmarshal([]byte(rawReview), &parsedReview); err == nil {
			parts := strings.Split(key, ":")
			taskID := parts[len(parts)-1]
			activeReviews = append(activeReviews, map[string]interface{}{
				"taskId":  taskID,
				"details": parsedReview,
			})
		}
	}

	if parsedQueue == nil {
		parsedQueue = make([]map[string]interface{}, 0)
	}
	if activeReviews == nil {
		activeReviews = make([]map[string]interface{}, 0)
	}

	return parsedQueue, activeReviews, nil
}

func InviteDeveloperService(orgID, targetEmail string) (string, error, int) {
	log.Printf("✉️ [ADMIN] Attempting to invite %s to Org: %s\n", targetEmail, orgID)

	var existingUser models.User
	if err := database.DB.Where("email = ?", targetEmail).First(&existingUser).Error; err == nil {
		log.Printf("🔄 [ADMIN] User %s already exists. Performing Smart Merge into Org: %s\n", targetEmail, orgID)

		if updateErr := database.DB.Model(&existingUser).Updates(map[string]interface{}{
			"org_id": orgID,
			"role":   "developer",
		}).Error; updateErr != nil {
			log.Printf("❌ [ADMIN] Failed to merge existing user: %v\n", updateErr)
			return "", errors.New("failed to update existing user's organization"), http.StatusInternalServerError
		}

		return "This developer already had an account and was instantly added to your team roster!", nil, http.StatusOK
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "https://tron-v3.vercel.app"
	}
	redirectURL := fmt.Sprintf("%s/onboarding/set-password", frontendURL)

	baseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if baseURL == "" || serviceKey == "" {
		log.Println("❌ [ADMIN] Server Configuration Error: Missing Supabase keys.")
		return "", errors.New("internal server configuration error"), http.StatusInternalServerError
	}

	params := map[string]interface{}{
		"email": targetEmail,
		"data": map[string]interface{}{
			"org_id": orgID,
			"role":   "developer",
		},
		"redirect_to": redirectURL,
	}

	inviteEndpoint := fmt.Sprintf("%s/auth/v1/invite?redirect_to=%s", baseURL, redirectURL)

	payloadBytes, err := json.Marshal(params)
	if err != nil {
		log.Printf("❌ [ADMIN] JSON Marshal Error: %v\n", err)
		return "", errors.New("failed to format invite data"), http.StatusInternalServerError
	}

	req, err := http.NewRequestWithContext(context.Background(), "POST", inviteEndpoint, bytes.NewReader(payloadBytes))
	if err != nil {
		log.Printf("❌ [ADMIN] Request Creation Error: %v\n", err)
		return "", errors.New("failed to create authentication request"), http.StatusInternalServerError
	}

	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [ADMIN] Supabase Network Error: %v\n", err)
		return "", errors.New("failed to communicate with authentication provider"), http.StatusBadGateway
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("❌ [ADMIN] Supabase Rejection (Status %d): %s\n", resp.StatusCode, string(respBody))
		return "", errors.New("authentication provider rejected the invite"), http.StatusInternalServerError
	}

	var result struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [ADMIN] Decode Error: %v\n", err)
		return "", errors.New("invite sent, but failed to parse provider response"), http.StatusInternalServerError
	}

	dbResult := database.DB.Exec("INSERT INTO users (id, email, org_id, role) VALUES (?, ?, ?, 'developer') ON CONFLICT (id) DO NOTHING", result.ID, targetEmail, orgID)
	if dbResult.Error != nil {
		log.Printf("❌ [ADMIN] Database Insertion Error: %v\n", dbResult.Error)
	}

	return fmt.Sprintf("Invite sent to %s successfully!", targetEmail), nil, http.StatusOK
}

func RemoveDeveloperService(adminID, adminOrgID, targetUserID string) (string, error, int) {
	if adminID == targetUserID {
		return "", errors.New("you cannot remove yourself from the team"), http.StatusBadRequest
	}

	var targetUser models.User
	if err := database.DB.Where("id = ? AND org_id = ?", targetUserID, adminOrgID).First(&targetUser).Error; err != nil {
		return "", errors.New("developer not found in your team"), http.StatusNotFound
	}

	if err := database.DB.Where("user_id = ?", targetUserID).Delete(&models.ProjectAssignment{}).Error; err != nil {
		return "", errors.New("failed to revoke workflow assignments"), http.StatusInternalServerError
	}

	if err := database.DB.Model(&targetUser).Update("org_id", "").Error; err != nil {
		return "", errors.New("failed to remove developer from team"), http.StatusInternalServerError
	}

	return "Developer successfully removed from the team.", nil, http.StatusOK
}

func LinkRepositoryService(orgID, repoName, pmProvider, pmProjectID string, mapping, commConfig map[string]interface{}) error {
	mappingJSON, _ := json.Marshal(mapping)
	commJSON, _ := json.Marshal(commConfig)

	repo := models.Repository{
		OrgID:               orgID,
		RepoName:            repoName,
		PMProvider:          pmProvider,
		PMProjectID:         pmProjectID,
		Mapping:             datatypes.JSON(mappingJSON),
		CommunicationConfig: datatypes.JSON(commJSON),
	}

	if err := database.DB.Save(&repo).Error; err != nil {
		return errors.New("failed to save repository configuration")
	}
	return nil
}

func FetchBasecampProjects(orgID string) ([]map[string]interface{}, error) {
	var integration models.Integration
	if err := database.DB.Where("provider = ? AND org_id = ?", "basecamp", orgID).First(&integration).Error; err != nil {
		return []map[string]interface{}{}, nil
	}

	decryptedJSON, _ := vault.GetDecryptedSecret(*integration.SecretID)
	var creds map[string]string
	json.Unmarshal([]byte(decryptedJSON), &creds)

	url := fmt.Sprintf("https://3.basecampapi.com/%s/projects.json", creds["accountId"])
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+creds["accessToken"])
	req.Header.Set("User-Agent", "TRON-V3-Engine (admin@tron.local)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		return []map[string]interface{}{}, nil
	}
	defer resp.Body.Close()

	var rawProjects []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rawProjects)

	var projects []map[string]interface{}
	for _, p := range rawProjects {
		idStr := fmt.Sprintf("%v", p["id"])
		if fVal, ok := p["id"].(float64); ok {
			idStr = fmt.Sprintf("%.0f", fVal)
		}

		projects = append(projects, map[string]interface{}{
			"id":       idStr,
			"name":     p["name"],
			"provider": "basecamp",
		})
	}

	return projects, nil
}

func FetchDiscordStatus(orgID string) ([]map[string]interface{}, error) {
	var integration models.Integration
	err := database.DB.Where("org_id = ? AND provider IN ?", orgID, []string{"discord", "discord_bot"}).First(&integration).Error
	if err != nil || integration.SecretID == nil {
		return []map[string]interface{}{}, nil
	}

	decryptedSecret, _ := vault.GetDecryptedSecret(*integration.SecretID)
	actualToken := decryptedSecret

	var creds map[string]interface{}
	if parseErr := json.Unmarshal([]byte(decryptedSecret), &creds); parseErr == nil {
		if val, ok := creds["botToken"].(string); ok {
			actualToken = val
		} else if val, ok := creds["bot_token"].(string); ok {
			actualToken = val
		}
	}

	req, _ := http.NewRequest("GET", "https://discord.com/api/v10/users/@me/guilds", nil)
	req.Header.Set("Authorization", "Bot "+actualToken)
	client := &http.Client{Timeout: 5 * time.Second}
	guildsRes, err := client.Do(req)

	if err != nil || guildsRes.StatusCode >= 400 {
		return []map[string]interface{}{}, nil
	}
	defer guildsRes.Body.Close()

	var guilds []map[string]interface{}
	json.NewDecoder(guildsRes.Body).Decode(&guilds)
	if len(guilds) == 0 {
		return []map[string]interface{}{}, nil
	}

	guildID := fmt.Sprintf("%v", guilds[0]["id"])

	req2, _ := http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/channels", guildID), nil)
	req2.Header.Set("Authorization", "Bot "+actualToken)
	channelsRes, err := client.Do(req2)
	if err != nil || channelsRes.StatusCode >= 400 {
		return []map[string]interface{}{}, nil
	}
	defer channelsRes.Body.Close()

	var allChannels []map[string]interface{}
	json.NewDecoder(channelsRes.Body).Decode(&allChannels)

	var textChannels []map[string]interface{}
	for _, ch := range allChannels {
		if fmt.Sprintf("%v", ch["type"]) == "0" {
			textChannels = append(textChannels, map[string]interface{}{
				"id":   ch["id"],
				"name": ch["name"],
			})
		}
	}
	return textChannels, nil
}

func FetchBasecampColumns(orgID, projectID string) ([]map[string]interface{}, error, int) {
	fmt.Printf("\n🔍 [BASECAMP] Fetching Columns for Project: %s (Org: %s)\n", projectID, orgID)

	var integration models.Integration
	if err := database.DB.Where("provider = ? AND org_id = ?", "basecamp", orgID).First(&integration).Error; err != nil {
		fmt.Printf("❌ [BASECAMP] Integration not found in DB\n")
		return nil, errors.New("basecamp not connected"), http.StatusInternalServerError
	}

	decryptedJSON, err := vault.GetDecryptedSecret(*integration.SecretID)
	if err != nil {
		fmt.Printf("❌ [BASECAMP] Failed to decrypt Vault secret: %v\n", err)
		return nil, errors.New("vault decryption failed"), http.StatusInternalServerError
	}

	var creds map[string]string
	json.Unmarshal([]byte(decryptedJSON), &creds)

	client := &http.Client{Timeout: 10 * time.Second}
	makeRequest := func(url string) (*http.Response, error) {
		req, _ := http.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer "+creds["accessToken"])
		req.Header.Set("User-Agent", "TRON-V3-Engine (admin@tron.local)")
		return client.Do(req)
	}

	dockURL := fmt.Sprintf("https://3.basecampapi.com/%s/projects/%s.json", creds["accountId"], projectID)
	fmt.Printf("🔍 [BASECAMP] Requesting Dock metadata from: %s\n", dockURL)

	resp, err := makeRequest(dockURL)
	if err != nil || resp.StatusCode >= 400 {
		if resp != nil {
			errBody, _ := io.ReadAll(resp.Body)
			fmt.Printf("❌ [BASECAMP] Dock API Error (%d): %s\n", resp.StatusCode, string(errBody))
			resp.Body.Close()
		}
		return nil, errors.New("failed to fetch project dock"), http.StatusInternalServerError
	}
	defer resp.Body.Close()

	var projectRes struct {
		Dock []struct {
			Name  string `json:"name"`
			Title string `json:"title"`
			URL   string `json:"url"`
		} `json:"dock"`
	}
	json.NewDecoder(resp.Body).Decode(&projectRes)

	var toolURL string
	for _, t := range projectRes.Dock {
		name := strings.ToLower(t.Name)
		title := strings.ToLower(t.Title)
		if strings.Contains(name, "card") || strings.Contains(title, "card") ||
			strings.Contains(name, "kanban") || strings.Contains(title, "kanban") {
			toolURL = t.URL
			fmt.Printf("✅ [BASECAMP] Found Kanban Tool! URL: %s\n", toolURL)
			break
		}
	}

	if toolURL == "" {
		for _, t := range projectRes.Dock {
			name := strings.ToLower(t.Name)
			title := strings.ToLower(t.Title)
			if strings.Contains(name, "todoset") || strings.Contains(title, "todo") || strings.Contains(title, "to-do") {
				toolURL = t.URL
				fmt.Printf("✅ [BASECAMP] Found To-Do Tool (Fallback)! URL: %s\n", toolURL)
				break
			}
		}
	}

	if toolURL == "" {
		fmt.Printf("❌ [BASECAMP] No Card Table or To-Do list found in dock payload.\n")
		return nil, errors.New("no card table or to-do list found"), http.StatusBadRequest
	}

	fmt.Printf("🔍 [BASECAMP] Requesting Columns metadata from: %s\n", toolURL)
	toolResp, err := makeRequest(toolURL)
	if err != nil || toolResp.StatusCode >= 400 {
		if toolResp != nil {
			errBody, _ := io.ReadAll(toolResp.Body)
			fmt.Printf("❌ [BASECAMP] Columns API Error (%d): %s\n", toolResp.StatusCode, string(errBody))
			toolResp.Body.Close()
		}
		return nil, errors.New("failed to fetch tool metadata"), http.StatusInternalServerError
	}
	defer toolResp.Body.Close()

	var toolData map[string]interface{}
	json.NewDecoder(toolResp.Body).Decode(&toolData)

	var rawLists []interface{}
	if lists, ok := toolData["lists"].([]interface{}); ok {
		rawLists = lists
	}
	if columns, ok := toolData["columns"].([]interface{}); ok && rawLists == nil {
		rawLists = columns
	}
	if todos, ok := toolData["todolists"].([]interface{}); ok && rawLists == nil {
		rawLists = todos
	}

	targetURL := ""
	if url, ok := toolData["lists_url"].(string); ok {
		targetURL = url
	}
	if url, ok := toolData["todolists_url"].(string); ok && targetURL == "" {
		targetURL = url
	}

	if rawLists == nil && targetURL != "" {
		fmt.Printf("🔍 [BASECAMP] Following pagination lists_url: %s\n", targetURL)
		listsResp, err := makeRequest(targetURL)
		if err == nil && listsResp.StatusCode < 400 {
			defer listsResp.Body.Close()
			json.NewDecoder(listsResp.Body).Decode(&rawLists)
		} else if listsResp != nil {
			errBody, _ := io.ReadAll(listsResp.Body)
			fmt.Printf("❌ [BASECAMP] Pagination API Error (%d): %s\n", listsResp.StatusCode, string(errBody))
			listsResp.Body.Close()
		}
	}

	if rawLists == nil {
		rawLists = make([]interface{}, 0)
	}

	var columns []map[string]interface{}
	for _, item := range rawLists {
		listMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		name := listMap["title"]
		if name == nil {
			name = listMap["name"]
		}

		idStr := fmt.Sprintf("%v", listMap["id"])
		if fVal, ok := listMap["id"].(float64); ok {
			idStr = fmt.Sprintf("%.0f", fVal)
		}

		columns = append(columns, map[string]interface{}{
			"id":   idStr,
			"name": name,
		})
	}

	fmt.Printf("🎉 [BASECAMP] Successfully returning %d columns!\n\n", len(columns))
	return columns, nil, http.StatusOK
}

func UninstallGitHubAppService(orgID string) (error, int) {
	fmt.Printf("🐛 [GITHUB UNINSTALL] Initiating cleanup for Org: %s\n", orgID)

	var integration models.Integration
	if err := database.DB.Where("org_id = ? AND provider = ?", orgID, "github").First(&integration).Error; err != nil {
		fmt.Printf("✅ [GITHUB UNINSTALL] No integration found in DB. Already clean.\n")
		return nil, http.StatusOK
	}

	installationID := integration.Token
	if installationID == "" && integration.SecretID != nil {
		installationID, _ = vault.GetDecryptedSecret(*integration.SecretID)
	}

	if installationID == "" {
		fmt.Printf("⚠️ [GITHUB UNINSTALL] No Installation ID found. Wiping local DB record.\n")
		database.DB.Delete(&integration)
		return nil, http.StatusOK
	}

	appJWT, err := githubauth.GenerateAppJWT()
	if err != nil {
		fmt.Printf("❌ [GITHUB UNINSTALL] Failed to generate App JWT: %v\n", err)
		return errors.New("failed to generate app jwt"), http.StatusInternalServerError
	}

	url := fmt.Sprintf("https://api.github.com/app/installations/%s", installationID)
	req, _ := http.NewRequest("DELETE", url, nil)
	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		fmt.Printf("❌ [GITHUB UNINSTALL] API Request Failed: %v\n", err)
	} else if resp.StatusCode >= 400 && resp.StatusCode != http.StatusNotFound {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ [GITHUB UNINSTALL] API Error (%d): %s\n", resp.StatusCode, string(bodyBytes))
		if resp != nil {
			resp.Body.Close()
		}
		return errors.New("failed to uninstall from github api"), http.StatusInternalServerError
	}

	if resp != nil {
		defer resp.Body.Close()
	}

	if integration.SecretID != nil {
		vault.DeleteSecret(*integration.SecretID)
	}
	database.DB.Delete(&integration)

	fmt.Printf("🎉 [GITHUB UNINSTALL] Successfully wiped Integration for Org: %s\n", orgID)
	return nil, http.StatusOK
}
