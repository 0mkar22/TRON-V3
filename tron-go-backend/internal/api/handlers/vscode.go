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

// ==========================================
// 🛠️ HELPER: LOAD REPO & ORCHESTRATOR
// ==========================================
func getRepoAndOrchestrator(repoName string) (models.Repository, map[string]interface{}, *services.PMOrchestrator, error) {
	var repo models.Repository
	if err := database.DB.Where("repo_name = ?", repoName).First(&repo).Error; err != nil {
		return repo, nil, nil, err
	}

	var mapping map[string]interface{}
	json.Unmarshal([]byte(repo.Mapping), &mapping)

	orch := services.NewPMOrchestrator(adapters.NewBasecampAdapter())
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
// 2. VS CODE: FETCH TICKETS
// ==========================================
func GetTickets(c *gin.Context) {
	repoName := c.Query("repo")
	orgID := c.GetString("orgId")

	repo, mapping, orch, err := getRepoAndOrchestrator(repoName)
	if err != nil || repo.PMProvider == "none" {
		c.JSON(http.StatusOK, gin.H{"isMapped": false, "tickets": []interface{}{}})
		return
	}

	tickets := orch.GetTickets(repo.PMProvider, repo.PMProjectID, orgID, mapping)

	if tickets == nil {
		tickets = make([]services.Ticket, 0)
	}
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

	repo, mapping, orch, err := getRepoAndOrchestrator(body.RepoName)
	if err != nil || repo.PMProvider == "none" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No PM tool configured in database."})
		return
	}

	newTicketID := orch.ResolveTask(repo.PMProvider, repo.PMProjectID, body.TaskInput, orgID, mapping)
	c.JSON(http.StatusOK, gin.H{"resolvedId": newTicketID})
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

	repo, mapping, orch, err := getRepoAndOrchestrator(body.RepoName)

	// Fallback ID generation if PM isn't linked
	re := regexp.MustCompile(`[^a-zA-Z0-9]`)
	resolvedTaskID := strings.ToLower(re.ReplaceAllString(body.TaskInput, "-"))

	if err == nil && repo.PMProvider != "none" {
		resolvedTaskID = orch.ResolveTask(repo.PMProvider, repo.PMProjectID, body.TaskInput, orgID, mapping)

		// 🌟 FIX 1: Helper to safely extract Basecamp IDs whether they are strings or float64 numbers!
		extractID := func(key string) string {
			if val, ok := mapping[key].(string); ok {
				return val
			} else if val, ok := mapping[key].(float64); ok {
				return fmt.Sprintf("%.0f", val) // Force literal number, no scientific notation
			}
			return ""
		}

		inProgressID := extractID("branch_created")
		if inProgressID == "" {
			inProgressID = extractID("in_progress")
		}

		if inProgressID != "" {
			fmt.Printf("🚚 [API] Moving task [%s] to In Progress column (%s)...\n", resolvedTaskID, inProgressID)
			orch.UpdateTicketStatus(repo.PMProvider, repo.PMProjectID, resolvedTaskID, inProgressID, orgID)
		} else {
			fmt.Printf("⚠️ [API] Could not find an 'in_progress' mapping! (Check TRON dashboard mapping names)\n")
		}

		if body.Developer != "" {
			fmt.Printf("👤 [API] Attempting to assign developer: %s\n", body.Developer)
			orch.AssignTicket(repo.PMProvider, repo.PMProjectID, resolvedTaskID, body.Developer, orgID)
		}

		// Push to Worker Queue
		queuePayload := map[string]interface{}{
			"eventType": "local_start",
			"payload": map[string]interface{}{
				"taskId":     resolvedTaskID,
				"repository": map[string]string{"full_name": body.RepoName},
			},
		}
		queueJSON, _ := json.Marshal(queuePayload)

		// 🌟 FIX 2: Send this to the exact queue name the Worker is actually listening to
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
