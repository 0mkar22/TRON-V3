package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
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
		select {
		case ch <- string(logBytes):
		default:
		}
	}
}

func StreamLogs(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")

	clientChan := make(chan string, 10)
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

	initMsg := `{"id": "connected", "time": "` + time.Now().Format("15:04:05") + `", "source": "System", "message": "Connected to TRON Live Stream...", "color": "text-emerald-500"}`
	fmt.Fprintf(c.Writer, "data: %s\n\n", initMsg)
	c.Writer.Flush()

	notify := c.Request.Context().Done()
	for {
		select {
		case <-notify:
			return
		case msg := <-clientChan:
			fmt.Fprintf(c.Writer, "data: %s\n\n", msg)
			c.Writer.Flush()
		}
	}
}

type basecampAdapterWrapper struct {
	*adapters.BasecampAdapter
}

func (w *basecampAdapterWrapper) AssignDeveloper(taskID, projectID, developer, orgID string) error {
	return w.BasecampAdapter.AssignDeveloper(taskID, projectID, developer)
}

// ==========================================
// 🛡️ AUTH HELPER: Extract User from JWT
// ==========================================
func getUserFromToken(c *gin.Context) (models.User, error) {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return models.User{}, fmt.Errorf("missing or invalid token")
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")

	vscodeService := services.NewVSCodeService()
	return vscodeService.GetUserFromToken(token)
}

// ==========================================
// 1. VS CODE: FETCH ASSIGNED PROJECTS
// ==========================================
func GetProjects(c *gin.Context) {
	dbUser, err := getUserFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	vscodeService := services.NewVSCodeService()
	projectNames, err := vscodeService.GetProjects(dbUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"projects": projectNames})
}

// ==========================================
// 2. VS CODE: FETCH TICKETS
// ==========================================
func GetTickets(c *gin.Context) {
	repoName := c.Query("repo")

	dbUser, err := getUserFromToken(c)
	if err != nil {
		fmt.Printf("🚨 [AUTH FATAL] %v\n", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	vscodeService := services.NewVSCodeService()
	isMapped, tickets, err := vscodeService.GetTickets(repoName, dbUser)
	if err != nil {
		if err.Error() == "RBAC_BLOCKED" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access Denied: Not assigned to workflow"})
			return
		}

		fmt.Printf("🛑 [ABORT] Returning isMapped: false due to DB error.\n")
		c.JSON(http.StatusOK, gin.H{"isMapped": false, "tickets": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"isMapped": isMapped, "tickets": tickets})
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

	vscodeService := services.NewVSCodeService()
	suggestions := vscodeService.SuggestTasks(body.CodeDiff)
	c.JSON(http.StatusOK, gin.H{"suggestions": suggestions})
}

// ==========================================
// 4. VS CODE: CREATE TASK
// ==========================================
func CreateTask(c *gin.Context) {
	var body struct {
		TaskInput string `json:"taskInput"`
		RepoName  string `json:"repoName"`
	}
	c.ShouldBindJSON(&body)

	dbUser, err := getUserFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	vscodeService := services.NewVSCodeService()
	resolvedTaskID, err := vscodeService.CreateTask(body.TaskInput, body.RepoName, dbUser)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"resolvedId": resolvedTaskID})
}

// ==========================================
// 5. VS CODE: START TASK
// ==========================================
func StartTask(c *gin.Context) {
	var body struct {
		TaskInput string `json:"taskInput"`
		RepoName  string `json:"repoName"`
		Developer string `json:"developer"`
	}
	c.ShouldBindJSON(&body)

	dbUser, err := getUserFromToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	vscodeService := services.NewVSCodeService()
	resolvedTaskID, _ := vscodeService.StartTask(body.TaskInput, body.RepoName, body.Developer, dbUser)

	c.JSON(http.StatusOK, gin.H{"resolvedId": resolvedTaskID})
}

// ==========================================
// 6. VS CODE: FETCH AI REVIEW
// ==========================================
func FetchAIReview(c *gin.Context) {
	taskID := c.Param("taskId")
	vscodeService := services.NewVSCodeService()
	review, err := vscodeService.FetchAIReview(taskID)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
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

	vscodeService := services.NewVSCodeService()
	channels, err := vscodeService.FetchDiscordChannels(body.BotToken)

	if err != nil {
		if err.Error() == "Bot is not in any Discord servers yet!" {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}
