package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
	"gorm.io/datatypes"
)

// ==========================================
// 1. GITHUB REPOSITORIES (App Secured)
// ==========================================
func GetGitHubRepos(c *gin.Context) {
	orgID := c.GetString("orgId")

	fmt.Printf("🔍 [GITHUB] Fetching repos for Org: %s\n", orgID)

	var integration models.Integration
	if err := database.DB.Where("org_id = ? AND provider = ?", orgID, "github").First(&integration).Error; err != nil {
		fmt.Printf("❌ [GITHUB] No github integration found in DB for Org: %s\n", orgID)
		c.JSON(http.StatusOK, gin.H{"repos": []interface{}{}})
		return
	}

	// 🌟 FIX: Check both Token (Plaintext) and SecretID (Vault) exactly like Node.js did
	installationID := integration.Token
	if installationID == "" && integration.SecretID != nil {
		fmt.Printf("🔍 [GITHUB] Token column empty, checking Vault (SecretID: %s)\n", *integration.SecretID)
		installationID, _ = services.GetDecryptedSecret(*integration.SecretID)
	}

	if installationID == "" {
		fmt.Printf("❌ [GITHUB] Installation ID is completely empty!\n")
		c.JSON(http.StatusOK, gin.H{"repos": []interface{}{}})
		return
	}

	fmt.Printf("✅ [GITHUB] Found Installation ID: %s. Generating App JWT...\n", installationID)

	token, err := services.GetInstallationToken(installationID)
	if err != nil {
		fmt.Printf("❌ [GITHUB] Failed to generate Installation Token: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate GitHub token"})
		return
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
		}
		c.JSON(http.StatusOK, gin.H{"repos": []interface{}{}})
		return
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
	c.JSON(http.StatusOK, gin.H{"repos": repos})
}

// ==========================================
// 5. SECURE DASHBOARD WORKFLOWS
// ==========================================
func GetDashboardWorkflows(c *gin.Context) {
	orgID := c.GetString("orgId")

	var workflows []models.Repository
	// 🔒 THE LOCK: Ensure it only fetches this tenant's workflows
	if err := database.DB.Where("org_id = ?", orgID).Find(&workflows).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"workflows": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workflows": workflows})
}

// ==========================================
// 6. SECURE SYSTEM STATUS (Mission Control)
// ==========================================
func GetSystemStatus(c *gin.Context) {
	ctx := context.Background()

	// 1. Fetch the Active Queue directly from Redis memory
	rawQueue, err := redis.Client.LRange(ctx, "tron:v3_secret_queue", 0, -1).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch queue from Redis"})
		return
	}

	var parsedQueue []map[string]interface{}
	for _, item := range rawQueue {
		var job map[string]interface{}
		if err := json.Unmarshal([]byte(item), &job); err == nil {
			parsedQueue = append(parsedQueue, job)
		}
	}

	// 2. Fetch the Cached AI Reviews from Redis memory
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

	c.JSON(http.StatusOK, gin.H{
		"queue":       parsedQueue,
		"reviews":     activeReviews,
		"queueCount":  len(parsedQueue),
		"reviewCount": len(activeReviews),
	})
}

// ==========================================
// 7. TEAM MANAGEMENT: INVITE DEVELOPER
// ==========================================
func InviteDeveloper(c *gin.Context) {
	orgID := c.GetString("orgId")

	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required."})
		return
	}

	fmt.Printf("✉️ [ADMIN] Attempting to invite %s to Org: %s\n", body.Email, orgID)

	params := map[string]interface{}{
		"email": body.Email,
		"data": map[string]interface{}{
			"org_id": orgID,
			"role":   "developer",
		},
		"redirectTo": "https://tron-v3.vercel.app/onboarding/set-password",
	}

	baseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	url := fmt.Sprintf("%s/auth/v1/invite", baseURL)
	payloadBytes, _ := json.Marshal(params)
	req, _ := http.NewRequest("POST", url, strings.NewReader(string(payloadBytes)))

	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)

	if err != nil || resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ [ADMIN] Invite Error: %s\n", string(respBody))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send invite."})
		return
	}
	defer resp.Body.Close()

	var result struct {
		ID string `json:"id"`
	}
	json.NewDecoder(resp.Body).Decode(&result)

	database.DB.Exec("INSERT INTO users (id, email, org_id, role) VALUES (?, ?, ?, 'developer') ON CONFLICT (id) DO NOTHING", result.ID, body.Email, orgID)

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Invite sent to %s successfully!", body.Email)})
}

// ==========================================
// 8. LINK REPOSITORY CONFIG
// ==========================================
func LinkRepository(c *gin.Context) {
	var body struct {
		OrgID               string                 `json:"orgId"`
		RepoName            string                 `json:"repoName"`
		PMProvider          string                 `json:"pmProvider"`
		PMProjectID         string                 `json:"pmProjectId"`
		Mapping             map[string]interface{} `json:"mapping"`
		CommunicationConfig map[string]interface{} `json:"communication_config"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	mappingJSON, _ := json.Marshal(body.Mapping)
	commJSON, _ := json.Marshal(body.CommunicationConfig)

	repo := models.Repository{
		OrgID:               body.OrgID,
		RepoName:            body.RepoName,
		PMProvider:          body.PMProvider,
		PMProjectID:         body.PMProjectID,
		Mapping:             datatypes.JSON(mappingJSON),
		CommunicationConfig: datatypes.JSON(commJSON),
	}

	if err := database.DB.Save(&repo).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save repository configuration"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Repository linked successfully."})
}

// ==========================================
// 9. BASECAMP PROJECTS
// ==========================================
func GetBasecampProjects(c *gin.Context) {
	orgID := c.GetString("orgId")

	var integration models.Integration
	if err := database.DB.Where("provider = ? AND org_id = ?", "basecamp", orgID).First(&integration).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"projects": []interface{}{}})
		return
	}

	decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)
	var creds map[string]string
	json.Unmarshal([]byte(decryptedJSON), &creds)

	url := fmt.Sprintf("https://3.basecampapi.com/%s/projects.json", creds["accountId"])
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+creds["accessToken"])
	req.Header.Set("User-Agent", "TRON-V3-Engine (admin@tron.local)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		c.JSON(http.StatusOK, gin.H{"projects": []interface{}{}})
		return
	}
	defer resp.Body.Close()

	var rawProjects []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&rawProjects)

	var projects []map[string]interface{}
	for _, p := range rawProjects {
		// 🌟 FIX: Safely cast the float64 to a solid integer string to prevent scientific notation
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

	c.JSON(http.StatusOK, gin.H{"projects": projects})
}

// ==========================================
// 10. DISCORD STATUS
// ==========================================
func GetDiscordStatus(c *gin.Context) {
	orgID := c.GetString("orgId")

	var integration models.Integration
	err := database.DB.Where("org_id = ? AND provider IN ?", orgID, []string{"discord", "discord_bot"}).First(&integration).Error
	if err != nil || integration.SecretID == nil {
		c.JSON(http.StatusOK, gin.H{"channels": []interface{}{}})
		return
	}

	decryptedSecret, _ := services.GetDecryptedSecret(*integration.SecretID)
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
		c.JSON(http.StatusOK, gin.H{"channels": []interface{}{}})
		return
	}
	defer guildsRes.Body.Close()

	var guilds []map[string]interface{}
	json.NewDecoder(guildsRes.Body).Decode(&guilds)
	if len(guilds) == 0 {
		c.JSON(http.StatusOK, gin.H{"channels": []interface{}{}})
		return
	}

	guildID := fmt.Sprintf("%v", guilds[0]["id"])

	req2, _ := http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/channels", guildID), nil)
	req2.Header.Set("Authorization", "Bot "+actualToken)
	channelsRes, err := client.Do(req2)
	if err != nil || channelsRes.StatusCode >= 400 {
		c.JSON(http.StatusOK, gin.H{"channels": []interface{}{}})
		return
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
	c.JSON(http.StatusOK, gin.H{"channels": textChannels})
}

// ==========================================
// 11. BASECAMP COLUMNS (ULTRA-ROBUST)
// ==========================================
func GetBasecampColumns(c *gin.Context) {
	var body struct {
		ProjectID string `json:"projectId"`
		OrgID     string `json:"orgId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ProjectID == "" || body.OrgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing Project ID or Org ID."})
		return
	}

	fmt.Printf("\n🔍 [BASECAMP] Fetching Columns for Project: %s (Org: %s)\n", body.ProjectID, body.OrgID)

	var integration models.Integration
	if err := database.DB.Where("provider = ? AND org_id = ?", "basecamp", body.OrgID).First(&integration).Error; err != nil {
		fmt.Printf("❌ [BASECAMP] Integration not found in DB\n")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Basecamp not connected"})
		return
	}

	decryptedJSON, err := services.GetDecryptedSecret(*integration.SecretID)
	if err != nil {
		fmt.Printf("❌ [BASECAMP] Failed to decrypt Vault secret: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Vault decryption failed"})
		return
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

	dockURL := fmt.Sprintf("https://3.basecampapi.com/%s/projects/%s.json", creds["accountId"], body.ProjectID)
	fmt.Printf("🔍 [BASECAMP] Requesting Dock metadata from: %s\n", dockURL)

	resp, err := makeRequest(dockURL)
	if err != nil || resp.StatusCode >= 400 {
		if resp != nil {
			errBody, _ := io.ReadAll(resp.Body)
			fmt.Printf("❌ [BASECAMP] Dock API Error (%d): %s\n", resp.StatusCode, string(errBody))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch project dock"})
		return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "No Card Table or To-Do list found."})
		return
	}

	fmt.Printf("🔍 [BASECAMP] Requesting Columns metadata from: %s\n", toolURL)
	toolResp, err := makeRequest(toolURL)
	if err != nil || toolResp.StatusCode >= 400 {
		if toolResp != nil {
			errBody, _ := io.ReadAll(toolResp.Body)
			fmt.Printf("❌ [BASECAMP] Columns API Error (%d): %s\n", toolResp.StatusCode, string(errBody))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tool metadata"})
		return
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

		// 🌟 FIX: Safely cast the Column ID float64 to a solid integer string
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
	c.JSON(http.StatusOK, gin.H{"columns": columns})
}

// ==========================================
// 12. UNINSTALL GITHUB APP
// ==========================================
func UninstallGitHubApp(c *gin.Context) {
	orgID := c.Query("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing orgId"})
		return
	}

	fmt.Printf("🐛 [GITHUB UNINSTALL] Initiating cleanup for Org: %s\n", orgID)

	var integration models.Integration
	if err := database.DB.Where("org_id = ? AND provider = ?", orgID, "github").First(&integration).Error; err != nil {
		fmt.Printf("✅ [GITHUB UNINSTALL] No integration found in DB. Already clean.\n")
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	// 🌟 FIX 1: Check both Token (Plaintext) and SecretID (Vault)
	installationID := integration.Token
	if installationID == "" && integration.SecretID != nil {
		installationID, _ = services.GetDecryptedSecret(*integration.SecretID)
	}

	if installationID == "" {
		fmt.Printf("⚠️ [GITHUB UNINSTALL] No Installation ID found. Wiping local DB record.\n")
		database.DB.Delete(&integration)
		c.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	appJWT, err := services.GenerateAppJWT()
	if err != nil {
		fmt.Printf("❌ [GITHUB UNINSTALL] Failed to generate App JWT: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate App JWT"})
		return
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
		// 🌟 FIX 2: Ignore 404s! If it's a 404, it means it's already uninstalled on GitHub.
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("❌ [GITHUB UNINSTALL] API Error (%d): %s\n", resp.StatusCode, string(bodyBytes))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to uninstall from GitHub API"})
		return
	}

	if resp != nil {
		defer resp.Body.Close()
	}

	// Clean up Vault and Database
	if integration.SecretID != nil {
		services.DeleteSecret(*integration.SecretID)
	}
	database.DB.Delete(&integration)

	fmt.Printf("🎉 [GITHUB UNINSTALL] Successfully wiped Integration for Org: %s\n", orgID)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
