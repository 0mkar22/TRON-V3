package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
)

type QueueJob struct {
	DeliveryID string                 `json:"deliveryId"`
	EventType  string                 `json:"eventType"`
	Payload    map[string]interface{} `json:"payload"`
}

// Start begins the Redis polling loop in the background
func Start(ctx context.Context) {
	log.Println("📡 Integrated T.R.O.N. Worker is live and listening to 'tron:v3_secret_queue'")

	githubAPI := adapters.NewGitHubAdapter()
	basecampAPI := adapters.NewBasecampAdapter()
	aiAPI := adapters.NewAIAdapter()
	messengerAPI := adapters.NewMessengerAdapter()
	orchestrator := services.NewPMOrchestrator(basecampAPI)

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Halting integrated worker queue polling...")
			return
		default:
			// Block for 2 seconds waiting for a job, then loop
			result, err := redis.Client.BRPop(ctx, 2*time.Second, "tron:v3_secret_queue").Result()

			if err == context.Canceled {
				return
			}
			if err != nil {
				if err.Error() != "redis: nil" {
					log.Printf("⚠️ Redis pop error: %v", err)
					time.Sleep(1 * time.Second)
				}
				continue
			}

			var job QueueJob
			if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
				log.Printf("❌ Failed to parse job JSON: %v", err)
				continue
			}

			// Spin up a new Goroutine for the actual work so the queue never blocks
			go processJob(job, githubAPI, aiAPI, messengerAPI, orchestrator)
		}
	}
}

func processJob(job QueueJob, githubAPI *adapters.GitHubAdapter, aiAPI *adapters.AIAdapter, messengerAPI *adapters.MessengerAdapter, orchestrator *services.PMOrchestrator) {
	log.Printf("\n⚙️  [WORKER] Spinning up Goroutine for Delivery [%s]\n", job.DeliveryID)

	if job.EventType != "pull_request" {
		return
	}

	action, _ := job.Payload["action"].(string)
	if action == "opened" || action == "reopened" {
		handleNewPullRequest(job.Payload, githubAPI, aiAPI, messengerAPI, orchestrator)
	}
}

func handleNewPullRequest(payload map[string]interface{}, githubAPI *adapters.GitHubAdapter, aiAPI *adapters.AIAdapter, messengerAPI *adapters.MessengerAdapter, orchestrator *services.PMOrchestrator) {
	prData, _ := payload["pull_request"].(map[string]interface{})
	repoData, _ := payload["repository"].(map[string]interface{})
	installData, _ := payload["installation"].(map[string]interface{})
	senderData, _ := payload["sender"].(map[string]interface{})

	repoFullName, _ := repoData["full_name"].(string)

	// 🌟 FIX 1: Safely extract PR Number
	prNumber := 0
	if num, ok := prData["number"].(float64); ok {
		prNumber = int(num)
	}

	prTitle, _ := prData["title"].(string)
	developerName, _ := senderData["login"].(string)

	// 🌟 FIX 2: Safely extract the Installation ID as a strict string without scientific notation!
	var installID string
	if idFloat, ok := installData["id"].(float64); ok {
		installID = fmt.Sprintf("%.0f", idFloat)
	} else {
		installID = fmt.Sprintf("%v", installData["id"])
	}

	log.Printf("📦 [PIPELINE] New PR Detected: %s (#%d) by %s (Install ID: %s)\n", repoFullName, prNumber, developerName, installID)

	var repoConfig models.Repository
	if err := database.DB.Where("repo_name = ?", repoFullName).First(&repoConfig).Error; err != nil {
		log.Printf("⚠️ [PIPELINE] Repo '%s' is not mapped in TRON. Ignoring.\n", repoFullName)
		return
	}
	orgID := repoConfig.OrgID

	sanitizedDiff, err := githubAPI.FetchAndSanitizeDiff(repoFullName, prNumber, installID)
	if err != nil {
		log.Printf("❌ [PIPELINE] Failed to fetch diff: %v\n", err)
		return
	}

	log.Println("🧠 [PIPELINE] Analyzing Code...")
	aiSummary, _ := aiAPI.GenerateExecutiveSummary(prTitle, sanitizedDiff)
	aiCodeReview := aiAPI.GenerateCodeReview(sanitizedDiff)

	githubAPI.PostPullRequestComment(repoFullName, prNumber, aiCodeReview, installID)

	log.Println("🏗️  [PIPELINE] Synchronizing Project Management Boards...")
	var mapping map[string]interface{}
	json.Unmarshal([]byte(repoConfig.Mapping), &mapping)

	ticketID, _ := orchestrator.ResolveTask(repoConfig.PMProvider, repoConfig.PMProjectID, prTitle, orgID, mapping)
	orchestrator.AssignTicket(repoConfig.PMProvider, repoConfig.PMProjectID, ticketID, developerName, orgID)

	log.Println("📢 [PIPELINE] Broadcasting to team...")
	var commConfig adapters.CommunicationConfig
	json.Unmarshal([]byte(repoConfig.CommunicationConfig), &commConfig)

	report := adapters.AIReport{
		Intent:           aiSummary.Intent,
		ExecutiveSummary: aiSummary.ExecutiveSummary,
		BusinessImpact:   aiSummary.BusinessImpact,
	}

	prURL, _ := prData["html_url"].(string)
	messengerAPI.BroadcastSummary(commConfig, prTitle, prURL, report, orgID)

	log.Printf("🏁 [PIPELINE] Successfully processed PR #%d\n", prNumber)
}
