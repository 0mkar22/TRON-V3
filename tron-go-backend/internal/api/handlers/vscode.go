package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
)

// ==========================================
// 🚀 SSE LOG STREAMING ARCHITECTURE
// ==========================================
var (
	clientChans []chan string
	clientMutex sync.Mutex
)

// BroadcastLog sends a real-time message to all connected VS Code extensions
func BroadcastLog(source, message, color string) {
	logEntry := map[string]string{
		"id":      fmt.Sprintf("%d", time.Now().UnixMilli()),
		"time":    time.Now().Format("15:04:05"),
		"source":  source,
		"message": message,
		"color":   color,
	}
	logBytes, _ := json.Marshal(logEntry)

	clientMutex.Lock()
	defer clientMutex.Unlock()
	for _, ch := range clientChans {
		// Non-blocking send to prevent a stuck client from freezing the broadcaster
		select {
		case ch <- string(logBytes):
		default:
		}
	}
}

// StreamLogs handles the SSE connection from VS Code
func StreamLogs(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	clientChan := make(chan string, 10) // Buffer of 10 messages
	clientMutex.Lock()
	clientChans = append(clientChans, clientChan)
	clientMutex.Unlock()

	defer func() {
		clientMutex.Lock()
		for i, ch := range clientChans {
			if ch == clientChan {
				clientChans = append(clientChans[:i], clientChans[i+1:]...)
				break
			}
		}
		clientMutex.Unlock()
		close(clientChan)
	}()

	// Initial Connection Message
	initMsg := `{"id": "connected", "time": "` + time.Now().Format("15:04:05") + `", "source": "System", "message": "Connected to TRON Live Stream...", "color": "text-emerald-500"}`
	fmt.Fprintf(c.Writer, "data: %s\n\n", initMsg)
	c.Writer.Flush()

	notify := c.Request.Context().Done()
	for {
		select {
		case <-notify:
			// Client disconnected
			return
		case msg := <-clientChan:
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			c.Writer.Flush()
		}
	}
}

// basecampAdapterWrapper bridges the old BasecampAdapter implementation
// with the updated services.PMAdapter interface signature.
type basecampAdapterWrapper struct {
	*adapters.BasecampAdapter
}

func (w *basecampAdapterWrapper) AssignDeveloper(taskID, projectID, developer, orgID string) error {
	return w.BasecampAdapter.AssignDeveloper(taskID, projectID, developer)
}

// ==========================================
// 2. HELPER: LOAD REPO & ORCHESTRATOR (WITH TRAPS)
// ==========================================
func getRepoAndOrchestrator(repoName string, orgID string) (models.Repository, map[string]interface{}, *services.PMOrchestrator, error) {
	var repo models.Repository

	fmt.Printf("🔍 [DB TRAP] Searching for Repo: '%s' | OrgID: '%s'\n", repoName, orgID)

	if err := database.DB.Where("repo_name = ? AND org_id = ?", repoName, orgID).First(&repo).Error; err != nil {
		fmt.Printf("❌ [DB FATAL] Could not find mapping in database! Error: %v\n", err)
		return repo, nil, nil, err
	}

	fmt.Printf("✅ [DB SUCCESS] Found mapping! Provider: %s | Project Key: %s\n", repo.PMProvider, repo.PMProjectID)

	var mapping map[string]interface{}
	json.Unmarshal([]byte(repo.Mapping), &mapping)

	var orch *services.PMOrchestrator

	if repo.PMProvider == "basecamp" {
		fmt.Println("⛺ [ADAPTER TRAP] Booting Basecamp Orchestrator...")
		orch = services.NewPMOrchestrator(adapters.NewBasecampAdapter())
	} else if repo.PMProvider == "jira" {
		fmt.Println("📊 [ADAPTER TRAP] Booting Jira Logic...")

		var integration models.Integration
		if err := database.DB.Where("org_id = ? AND provider = 'jira'", orgID).First(&integration).Error; err != nil {
			fmt.Printf("❌ [VAULT FATAL] Could not find Jira keys in integrations table! Error: %v\n", err)
		} else {
			fmt.Println("✅ [VAULT SUCCESS] Retrieved Jira Integration Keys.")
		}
	} else if repo.PMProvider == "linear" {
		fmt.Println("⧓ [ADAPTER TRAP] Booting Linear Engine...")
	}

	return repo, mapping, orch, nil
}

// ==========================================
// 1. VS CODE: FETCH PROJECTS (Daemon Auth)
// ==========================================
func GetProjects(c *gin.Context) {
	apiKey := c.GetHeader("x-api-key")
	if apiKey != os.Getenv("DAEMON_API_KEY") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Invalid Daemon API Key"})
		return
	}

	var repos []models.Repository
	if err := database.DB.Select("repo_name").Find(&repos).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch projects"})
		return
	}

	var projectNames []string
	for _, repo := range repos {
		projectNames = append(projectNames, repo.RepoName)
	}

	c.JSON(http.StatusOK, gin.H{"projects": projectNames})
}

// ==========================================
// 2. VS CODE: FETCH TICKETS (WITH TRAPS)
// ==========================================
func GetTickets(c *gin.Context) {
	repoName := c.Query("repo")
	orgID := c.GetString("orgId")

	fmt.Println("\n================================================")
	fmt.Printf("📥 [VS CODE INCOMING] Requesting tickets for: %s\n", repoName)

	if orgID == "" {
		fmt.Println("🚨 [AUTH FATAL] orgId is EMPTY! The VS Code extension might not be sending the Bearer token!")
	}

	repo, mapping, orch, err := getRepoAndOrchestrator(repoName, orgID)
	if err != nil {
		fmt.Printf("🛑 [ABORT] Returning isMapped: false due to DB error.\n")
		c.JSON(http.StatusOK, gin.H{"isMapped": false, "tickets": []interface{}{}})
		return
	}

	if repo.PMProvider == "none" || repo.PMProvider == "" {
		fmt.Printf("⚠️ [ABORT] PM Provider is empty or 'none'.\n")
		c.JSON(http.StatusOK, gin.H{"isMapped": false, "tickets": []interface{}{}})
		return
	}

	// ---------------------------------------------------------
	// JIRA ROUTE
	// ---------------------------------------------------------
	if repo.PMProvider == "jira" {
		fmt.Println("🚀 [API TRAP] Fetching REAL tickets from Jira API...")

		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'jira'", orgID).First(&integration)

		var tickets []services.Ticket

		if integration.SecretID != nil {
			decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)
			var creds map[string]string
			json.Unmarshal([]byte(decryptedJSON), &creds)

			jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
			tickets = jiraAPI.GetTickets(repo.PMProjectID)
		}

		if tickets == nil {
			tickets = make([]services.Ticket, 0)
		}

		fmt.Printf("✅ [JIRA SUCCESS] Returning %d real Atlassian tickets to VS Code.\n", len(tickets))
		c.JSON(http.StatusOK, gin.H{
			"isMapped": true,
			"tickets":  tickets,
		})

		fmt.Println("================================================")
		return
	}

	// ---------------------------------------------------------
	// LINEAR ROUTE
	// ---------------------------------------------------------
	if repo.PMProvider == "linear" {
		fmt.Println("🚀 [API TRAP] Fetching REAL tickets from Linear API...")

		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'linear'", orgID).First(&integration)

		var tickets []services.Ticket

		if integration.SecretID != nil {
			decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)

			// 🛡️ DYNAMIC EXTRACTION: Handle both raw strings and JSON objects
			token := decryptedJSON
			var creds map[string]string
			if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
				if creds["token"] != "" {
					token = creds["token"]
				}
				if creds["apiKey"] != "" {
					token = creds["apiKey"]
				}
			}

			linearAPI := adapters.NewLinearAdapter(token)

			teamKey := ""
			if val, ok := mapping["team_key"].(string); ok {
				teamKey = val
			}

			if teamKey != "" {
				tickets = linearAPI.GetTickets(teamKey)
			}
		}

		if tickets == nil {
			tickets = make([]services.Ticket, 0)
		}

		fmt.Printf("✅ [LINEAR SUCCESS] Returning %d real Linear tickets to VS Code.\n", len(tickets))
		c.JSON(http.StatusOK, gin.H{
			"isMapped": true,
			"tickets":  tickets,
		})

		fmt.Println("================================================")
		return
	}

	// ---------------------------------------------------------
	// BASECAMP ROUTE (FALLBACK)
	// ---------------------------------------------------------
	fmt.Println("🚀 [API TRAP] Fetching tickets from Basecamp API...")
	tickets := orch.GetTickets(repo.PMProvider, repo.PMProjectID, orgID, mapping)

	if tickets == nil {
		tickets = make([]services.Ticket, 0)
	}

	fmt.Printf("✅ [API SUCCESS] Returning %d tickets to VS Code.\n", len(tickets))
	fmt.Println("================================================")

	c.JSON(http.StatusOK, gin.H{"isMapped": true, "tickets": tickets})
}

// ==========================================
// 3. VS CODE: AI SUGGEST TASKS
// ==========================================
func SuggestTasks(c *gin.Context) {
	var body struct {
		CodeDiff string `json:"codeDiff"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.CodeDiff) == "" {
		c.JSON(http.StatusOK, gin.H{"suggestions": []interface{}{}})
		return
	}

	aiAPI := adapters.NewAIAdapter()
	suggestions := aiAPI.GenerateTaskSuggestions(body.CodeDiff)

	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
}

// ==========================================
// 4. VS CODE: CREATE TASK (SILENT)
// ==========================================
func CreateTask(c *gin.Context) {
	var body struct {
		TaskInput string `json:"taskInput"`
		RepoName  string `json:"repoName"`
	}
	c.ShouldBindJSON(&body)
	orgID := c.GetString("orgId")

	repo, mapping, orch, err := getRepoAndOrchestrator(body.RepoName, orgID)
	if err != nil || repo.PMProvider == "none" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No PM tool configured in database."})
		return
	}

	var resolvedTaskID string

	if repo.PMProvider == "jira" {
		fmt.Printf("🏗️ [JIRA] VS Code requested a new ticket creation for: %s\n", body.TaskInput)

		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'jira'", orgID).First(&integration)

		if integration.SecretID != nil {
			decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)
			var creds map[string]string
			json.Unmarshal([]byte(decryptedJSON), &creds)

			jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])

			newID, err := jiraAPI.CreateTicket(repo.PMProjectID, body.TaskInput)
			if err == nil && newID != "" {
				resolvedTaskID = newID
			} else {
				fmt.Printf("❌ [JIRA] Failed to create ticket: %v\n", err)
				re := regexp.MustCompile(`[^a-zA-Z0-9]`)
				resolvedTaskID = strings.ToLower(re.ReplaceAllString(body.TaskInput, "-"))
			}
		}
	} else if repo.PMProvider == "linear" {
		fmt.Printf("🏗️ [LINEAR] VS Code requested a new ticket creation for: %s\n", body.TaskInput)

		var integration models.Integration
		database.DB.Where("org_id = ? AND provider = 'linear'", orgID).First(&integration)

		if integration.SecretID != nil {
			decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)

			// 🛡️ DYNAMIC EXTRACTION
			token := decryptedJSON
			var creds map[string]string
			if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
				if creds["token"] != "" {
					token = creds["token"]
				}
				if creds["apiKey"] != "" {
					token = creds["apiKey"]
				}
			}

			linearAPI := adapters.NewLinearAdapter(token)

			newID, err := linearAPI.CreateTicket(repo.PMProjectID, body.TaskInput)
			if err == nil && newID != "" {
				resolvedTaskID = newID
			} else {
				fmt.Printf("❌ [LINEAR] Failed to create ticket: %v\n", err)
				re := regexp.MustCompile(`[^a-zA-Z0-9]`)
				resolvedTaskID = strings.ToLower(re.ReplaceAllString(body.TaskInput, "-"))
			}
		}
	} else {
		resolvedTaskID, _ = orch.ResolveTask(repo.PMProvider, repo.PMProjectID, body.TaskInput, orgID, mapping)
	}

	c.JSON(http.StatusOK, gin.H{"resolvedId": resolvedTaskID})
}

// ==========================================
// 5. VS CODE: START TASK (MOVE & ASSIGN)
// ==========================================
func StartTask(c *gin.Context) {
	var body struct {
		TaskInput string `json:"taskInput"`
		RepoName  string `json:"repoName"`
		Developer string `json:"developer"`
	}
	c.ShouldBindJSON(&body)
	orgID := c.GetString("orgId")

	repo, mapping, orch, err := getRepoAndOrchestrator(body.RepoName, orgID)

	re := regexp.MustCompile(`[^a-zA-Z0-9]`)
	resolvedTaskID := strings.ToLower(re.ReplaceAllString(body.TaskInput, "-"))

	if err == nil && repo.PMProvider != "none" {

		if repo.PMProvider == "jira" {
			ticketID := adapters.ExtractTicketID(body.TaskInput)

			if ticketID != "" {
				resolvedTaskID = ticketID
				fmt.Printf("🚚 [JIRA] Starting task %s. Searching for 'In Progress' transition...\n", ticketID)

				var integration models.Integration
				database.DB.Where("org_id = ? AND provider = 'jira'", orgID).First(&integration)

				if integration.SecretID != nil {
					decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)
					var creds map[string]string
					json.Unmarshal([]byte(decryptedJSON), &creds)

					jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
					transitions, _ := jiraAPI.GetAvailableTransitions(ticketID)

					for _, t := range transitions {
						name, _ := t["name"].(string)
						if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
							transitionID, _ := t["id"].(string)
							jiraAPI.TransitionIssue(ticketID, transitionID)
							break
						}
					}
				}
			} else {
				fmt.Printf("🏗️ [JIRA] No ID found. Creating a brand new ticket for: %s\n", body.TaskInput)

				var integration models.Integration
				database.DB.Where("org_id = ? AND provider = 'jira'", orgID).First(&integration)

				if integration.SecretID != nil {
					decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)
					var creds map[string]string
					json.Unmarshal([]byte(decryptedJSON), &creds)

					jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])

					newID, err := jiraAPI.CreateTicket(repo.PMProjectID, body.TaskInput)
					if err == nil && newID != "" {
						resolvedTaskID = newID

						transitions, _ := jiraAPI.GetAvailableTransitions(newID)
						for _, t := range transitions {
							name, _ := t["name"].(string)
							if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
								transitionID, _ := t["id"].(string)
								jiraAPI.TransitionIssue(newID, transitionID)
								break
							}
						}
					} else {
						fmt.Printf("❌ [JIRA] Creation failed! Falling back to raw text. Error: %v\n", err)
					}
				}
			}

		} else if repo.PMProvider == "linear" {
			ticketID := adapters.ExtractTicketID(body.TaskInput)

			var integration models.Integration
			database.DB.Where("org_id = ? AND provider = 'linear'", orgID).First(&integration)

			if integration.SecretID != nil {
				decryptedJSON, _ := services.GetDecryptedSecret(*integration.SecretID)

				// 🛡️ DYNAMIC EXTRACTION
				token := decryptedJSON
				var creds map[string]string
				if json.Unmarshal([]byte(decryptedJSON), &creds) == nil {
					if creds["token"] != "" {
						token = creds["token"]
					}
					if creds["apiKey"] != "" {
						token = creds["apiKey"]
					}
				}

				linearAPI := adapters.NewLinearAdapter(token)

				if ticketID != "" {
					resolvedTaskID = ticketID
					fmt.Printf("🚚 [LINEAR] Starting task %s. Searching for 'In Progress' state...\n", ticketID)

					parts := strings.Split(ticketID, "-")
					if len(parts) == 2 {
						states, _ := linearAPI.GetAvailableStates(parts[0])
						for _, s := range states {
							name, _ := s["name"].(string)
							if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
								linearAPI.TransitionIssue(ticketID, s["id"].(string))
								break
							}
						}
					}
				} else {
					fmt.Printf("🏗️ [LINEAR] No ID found. Creating a brand new ticket for: %s\n", body.TaskInput)
					newID, err := linearAPI.CreateTicket(repo.PMProjectID, body.TaskInput)

					if err == nil && newID != "" {
						resolvedTaskID = newID

						parts := strings.Split(newID, "-")
						if len(parts) == 2 {
							states, _ := linearAPI.GetAvailableStates(parts[0])
							for _, s := range states {
								name, _ := s["name"].(string)
								if strings.Contains(strings.ToLower(name), "progress") || strings.Contains(strings.ToLower(name), "doing") {
									linearAPI.TransitionIssue(newID, s["id"].(string))
									break
								}
							}
						}
					} else {
						fmt.Printf("❌ [LINEAR] Creation failed! Error: %v\n", err)
					}
				}
			}

		} else {
			var exactCardUrl string
			resolvedTaskID, exactCardUrl = orch.ResolveTask(repo.PMProvider, repo.PMProjectID, body.TaskInput, orgID, mapping)

			extractID := func(key string) string {
				if val, ok := mapping[key].(string); ok {
					return val
				} else if val, ok := mapping[key].(float64); ok {
					return fmt.Sprintf("%.0f", val)
				}
				return ""
			}

			inProgressID := extractID("branch_created")
			if inProgressID == "" {
				inProgressID = extractID("in_progress")
			}

			if inProgressID != "" && exactCardUrl != "" {
				fmt.Printf("🚚 [API] Moving task using exact URL to In Progress column (%s)...\n", inProgressID)
				orch.UpdateTicketStatus(repo.PMProvider, repo.PMProjectID, exactCardUrl, inProgressID, orgID)
			} else {
				fmt.Printf("⚠️ [API] Could not find 'in_progress' mapping or exact URL!\n")
			}

			if body.Developer != "" && exactCardUrl != "" {
				fmt.Printf("👤 [API] Attempting to assign developer: %s\n", body.Developer)
				orch.AssignTicket(repo.PMProvider, repo.PMProjectID, exactCardUrl, body.Developer, orgID)
			}
		}

		// Push to Worker Queue (Common to Jira, Linear, and Basecamp)
		queuePayload := map[string]interface{}{
			"eventType": "local_start",
			"payload": map[string]interface{}{
				"taskId":     resolvedTaskID,
				"repository": map[string]string{"full_name": body.RepoName},
			},
		}
		queueJSON, _ := json.Marshal(queuePayload)
		redis.Client.LPush(context.Background(), "tron:v3_secret_queue", queueJSON)
	}

	c.JSON(http.StatusOK, gin.H{"resolvedId": resolvedTaskID})
}

// ==========================================
// 6. VS CODE: FETCH AI REVIEW
// ==========================================
func FetchAIReview(c *gin.Context) {
	taskID := c.Param("taskId")
	review, err := redis.Client.Get(context.Background(), "ai_review:"+taskID).Result()

	if err != nil || review == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "No AI review found for this task yet."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"review": review})
}

// ==========================================
// 7. UTILITY: FETCH DISCORD CHANNELS
// ==========================================
func FetchDiscordChannels(c *gin.Context) {
	var body struct {
		BotToken string `json:"botToken"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.BotToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bot token required"})
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Fetch Guilds
	req, _ := http.NewRequest("GET", "https://discord.com/api/v10/users/@me/guilds", nil)
	req.Header.Set("Authorization", "Bot "+body.BotToken)
	guildsRes, err := client.Do(req)

	if err != nil || guildsRes.StatusCode >= 400 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid token or Discord API error."})
		return
	}
	defer guildsRes.Body.Close()

	var guilds []map[string]interface{}
	json.NewDecoder(guildsRes.Body).Decode(&guilds)

	if len(guilds) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bot is not in any Discord servers yet!"})
		return
	}

	guildID := fmt.Sprintf("%v", guilds[0]["id"])

	// 2. Fetch Channels
	req, _ = http.NewRequest("GET", fmt.Sprintf("https://discord.com/api/v10/guilds/%s/channels", guildID), nil)
	req.Header.Set("Authorization", "Bot "+body.BotToken)
	channelsRes, err := client.Do(req)
	if err != nil || channelsRes.StatusCode >= 400 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid token or Discord API error."})
		return
	}
	defer channelsRes.Body.Close()

	var allChannels []map[string]interface{}
	json.NewDecoder(channelsRes.Body).Decode(&allChannels)

	var textChannels []map[string]interface{}
	for _, ch := range allChannels {
		if fmt.Sprintf("%v", ch["type"]) == "0" { // Type 0 is Text Channel
			textChannels = append(textChannels, map[string]interface{}{
				"id":   ch["id"],
				"name": ch["name"],
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"channels": textChannels})
}
