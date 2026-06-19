package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/logger"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
)

type QueueJob struct {
	DeliveryID string                 `json:"deliveryId"`
	EventType  string                 `json:"eventType"`
	Payload    map[string]interface{} `json:"payload"`
}

// Start begins the Redis polling loop in the background
func Start(ctx context.Context) {
	logger.Log.Info("📡 Integrated T.R.O.N. Worker is live and listening to 'tron:v3_secret_queue'")

	githubAPI := adapters.NewGitHubAdapter()
	basecampAPI := adapters.NewBasecampAdapter()
	aiAPI := adapters.NewAIAdapter()
	messengerAPI := adapters.NewMessengerAdapter()
	orchestrator := services.NewPMOrchestrator(basecampAPI)

	for {
		select {
		case <-ctx.Done():
			logger.Log.Info("🛑 Halting integrated worker queue polling...")
			return
		default:
			result, err := redis.Client.BRPop(ctx, 2*time.Second, "tron:v3_secret_queue").Result()

			if err == context.Canceled {
				return
			}
			if err != nil {
				if err.Error() != "redis: nil" {
					logger.Log.Warnf("⚠️ Redis pop error: %v", err)
					time.Sleep(1 * time.Second)
				}
				continue
			}

			var job QueueJob
			if err := json.Unmarshal([]byte(result[1]), &job); err != nil {
				logger.Log.Errorf("❌ Failed to parse job JSON: %v", err)
				continue
			}

			go processJob(job, githubAPI, aiAPI, messengerAPI, orchestrator)
		}
	}
}

func processJob(job QueueJob, githubAPI *adapters.GitHubAdapter, aiAPI *adapters.AIAdapter, messengerAPI *adapters.MessengerAdapter, orchestrator *services.PMOrchestrator) {
	logger.Log.Infof("\n⚙️  [WORKER] Processing Job [%s] - Type: %s\n", job.DeliveryID, job.EventType)

	// 🌟 FIX 1: Handle local VS Code task starts gracefully without dropping them
	if job.EventType == "local_start" {
		logger.Log.Infof("💻 [WORKER] Developer started task locally: %v\n", job.Payload["taskId"])
		// Future expansion: Add Discord broadcast logic here (e.g., "Omkar started working on TRON-123")
		return
	}

	if job.EventType != "pull_request" {
		return
	}

	action, _ := job.Payload["action"].(string)

	switch action {
	case "opened", "reopened":
		handleNewPullRequest(job.Payload, githubAPI, aiAPI, messengerAPI, orchestrator)
	case "closed":
		handleClosedPullRequest(job.Payload, orchestrator)
	default:
		// ignore other actions
	}
}

func handleClosedPullRequest(payload map[string]interface{}, orchestrator *services.PMOrchestrator) {
	prData, _ := payload["pull_request"].(map[string]interface{})
	repoData, _ := payload["repository"].(map[string]interface{})

	repoFullName, _ := repoData["full_name"].(string)
	prTitle, _ := prData["title"].(string)

	prNumber := 0
	if num, ok := prData["number"].(float64); ok {
		prNumber = int(num)
	}

	logger.Log.Infof("📦 [PIPELINE] PR Closed Detected: %s (#%d)\n", repoFullName, prNumber)

	var repoConfig models.Repository
	if err := database.DB.Where("repo_name = ?", repoFullName).First(&repoConfig).Error; err != nil {
		logger.Log.Warnf("⚠️ [PIPELINE] Repo '%s' is not mapped in TRON. Ignoring.\n", repoFullName)
		return
	}
	orgID := repoConfig.OrgID

	var mapping map[string]interface{}
	json.Unmarshal([]byte(repoConfig.Mapping), &mapping)

	headData, _ := prData["head"].(map[string]interface{})
	branchName, _ := headData["ref"].(string)

	searchQuery := prTitle
	if branchName != "" {
		searchQuery = prTitle + " " + branchName
	}

	_, exactUrl := orchestrator.ResolveTask(repoConfig.PMProvider, repoConfig.PMProjectID, searchQuery, orgID, mapping)

	if exactUrl != "" {
		extractID := func(key string) string {
			var target map[string]interface{} = mapping
			if nested, ok := mapping["mapping"].(map[string]interface{}); ok {
				target = nested
			}

			if val, ok := target[key].(string); ok {
				return val
			} else if val, ok := target[key].(float64); ok {
				return fmt.Sprintf("%.0f", val)
			}
			return ""
		}

		doneCol := extractID("pull_request_closed")
		if doneCol == "" {
			doneCol = extractID("done")
		}

		if doneCol != "" {
			logger.Log.Infof("🚚 [PIPELINE] Moving task to Done column (%s)...\n", doneCol)
			orchestrator.UpdateTicketStatus(repoConfig.PMProvider, repoConfig.PMProjectID, exactUrl, doneCol, orgID)
		} else {
			logger.Log.Warnf("⚠️ [PIPELINE] Could not find 'pull_request_closed' in mapping. Skipping column move.\n")
		}
	}
}

func handleNewPullRequest(payload map[string]interface{}, githubAPI *adapters.GitHubAdapter, aiAPI *adapters.AIAdapter, messengerAPI *adapters.MessengerAdapter, orchestrator *services.PMOrchestrator) {
	prData, _ := payload["pull_request"].(map[string]interface{})
	repoData, _ := payload["repository"].(map[string]interface{})
	senderData, _ := payload["sender"].(map[string]interface{})

	repoFullName, _ := repoData["full_name"].(string)

	prNumber := 0
	if num, ok := prData["number"].(float64); ok {
		prNumber = int(num)
	}

	prTitle, _ := prData["title"].(string)
	developerName, _ := senderData["login"].(string)

	var repoConfig models.Repository
	if err := database.DB.Where("repo_name = ?", repoFullName).First(&repoConfig).Error; err != nil {
		logger.Log.Warnf("⚠️ [PIPELINE] Repo '%s' is not mapped in TRON. Ignoring.\n", repoFullName)
		return
	}
	orgID := repoConfig.OrgID

	var installID string
	if installData, ok := payload["installation"].(map[string]interface{}); ok && installData != nil {
		if idFloat, ok := installData["id"].(float64); ok {
			installID = fmt.Sprintf("%.0f", idFloat)
		} else if installData["id"] != nil {
			installID = fmt.Sprintf("%v", installData["id"])
		}
	}

	if installID == "" || installID == "<nil>" {
		var githubInt models.Integration
		if err := database.DB.Where("org_id = ? AND provider = ?", orgID, "github").First(&githubInt).Error; err == nil {
			installID = githubInt.Token
			if installID == "" && githubInt.SecretID != nil {
				installID, _ = services.GetDecryptedSecret(*githubInt.SecretID)
			}
		}
	}

	if installID == "" || installID == "<nil>" {
		logger.Log.Errorf("❌ [PIPELINE] Could not find GitHub Installation ID in payload or Database. Aborting.\n")
		return
	}

	logger.Log.Infof("📦 [PIPELINE] New PR Detected: %s (#%d) by %s (Install ID: %s)\n", repoFullName, prNumber, developerName, installID)

	sanitizedDiff, err := githubAPI.FetchAndSanitizeDiff(repoFullName, prNumber, installID)
	if err != nil {
		logger.Log.Errorf("❌ [PIPELINE] Failed to fetch diff: %v\n", err)
		return
	}

	logger.Log.Info("🧠 [PIPELINE] Analyzing Code...")
	aiSummary, _ := aiAPI.GenerateExecutiveSummary(prTitle, sanitizedDiff)
	aiCodeReview := aiAPI.GenerateCodeReview(sanitizedDiff)

	githubAPI.PostPullRequestComment(repoFullName, prNumber, aiCodeReview, installID)

	logger.Log.Info("🏗️  [PIPELINE] Synchronizing Project Management Boards...")
	var mapping map[string]interface{}
	json.Unmarshal([]byte(repoConfig.Mapping), &mapping)

	headData, _ := prData["head"].(map[string]interface{})
	branchName, _ := headData["ref"].(string)

	searchQuery := prTitle
	if branchName != "" {
		searchQuery = prTitle + " " + branchName
	}

	_, exactUrl := orchestrator.ResolveTask(repoConfig.PMProvider, repoConfig.PMProjectID, searchQuery, orgID, mapping)

	if exactUrl != "" {
		// Assign Developer
		orchestrator.AssignTicket(repoConfig.PMProvider, repoConfig.PMProjectID, exactUrl, developerName, orgID)

		// 🌟 FIX 2: Save AI Review to Redis for the VS Code Extension (Expires in 7 Days)
		err := redis.Client.Set(context.Background(), "ai_review:"+exactUrl, aiCodeReview, 7*24*time.Hour).Err()
		if err != nil {
			logger.Log.Warnf("⚠️ [PIPELINE] Failed to cache AI review in Redis: %v\n", err)
		} else {
			logger.Log.Infof("💾 [PIPELINE] Cached AI Review in Redis for VS Code (Key: ai_review:%s)\n", exactUrl)
		}

		extractID := func(key string) string {
			var target map[string]interface{} = mapping
			if nested, ok := mapping["mapping"].(map[string]interface{}); ok {
				target = nested
			}

			if val, ok := target[key].(string); ok {
				return val
			} else if val, ok := target[key].(float64); ok {
				return fmt.Sprintf("%.0f", val)
			}
			return ""
		}

		underReviewCol := extractID("pull_request_opened")
		if underReviewCol == "" {
			underReviewCol = extractID("pr_opened")
		}
		if underReviewCol == "" {
			underReviewCol = extractID("under_review")
		}

		if underReviewCol != "" {
			logger.Log.Infof("🚚 [PIPELINE] Moving task to PR/Under Review column (%s)...\n", underReviewCol)
			orchestrator.UpdateTicketStatus(repoConfig.PMProvider, repoConfig.PMProjectID, exactUrl, underReviewCol, orgID)
		} else {
			logger.Log.Warnf("⚠️ [PIPELINE] Could not find 'pr_opened' or 'under_review' in mapping. Skipping column move.\n")
		}
	}

	logger.Log.Info("📢 [PIPELINE] Broadcasting to team...")
	var commConfig adapters.CommunicationConfig
	json.Unmarshal([]byte(repoConfig.CommunicationConfig), &commConfig)

	report := adapters.AIReport{
		Intent:           aiSummary.Intent,
		ExecutiveSummary: aiSummary.ExecutiveSummary,
		BusinessImpact:   aiSummary.BusinessImpact,
	}

	prURL, _ := prData["html_url"].(string)
	messengerAPI.BroadcastSummary(commConfig, prTitle, prURL, report, orgID)

	logger.Log.Infof("🏁 [PIPELINE] Successfully processed PR #%d\n", prNumber)
}
