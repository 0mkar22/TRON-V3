package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	// Make sure this path matches your actual module structure
	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
)

// HandleGitHubWebhook receives the payload, checks for duplicates, and queues it
func HandleGitHubWebhook(c *gin.Context) {
	eventType := c.GetHeader("x-github-event")
	deliveryID := c.GetHeader("x-github-delivery")

	if eventType == "" || deliveryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing GitHub headers"})
		return
	}

	// 1. Idempotency Check: Prevent duplicate webhook deliveries from GitHub
	ctx := context.Background()
	isNew, err := redis.Client.SetNX(ctx, "delivery:"+deliveryID, "processed", 48*time.Hour).Result()
	if err != nil || !isNew {
		c.String(http.StatusOK, "Duplicate delivery ignored")
		return
	}

	// 2. Read and Parse the Payload
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
		return
	}

	var payload map[string]interface{}
	json.Unmarshal(bodyBytes, &payload)

	// 3. Filter Events & Inject Jira Automation
	if eventType == "pull_request" {
		action, _ := payload["action"].(string)
		if action != "opened" && action != "closed" && action != "reopened" {
			c.String(http.StatusOK, "Ignored pull_request action")
			return
		}

		// ==========================================
		// SPRINT 1: JIRA ENTERPRISE AUTOMATION
		// ==========================================
		pr, prOk := payload["pull_request"].(map[string]interface{})
		if prOk {
			head, headOk := pr["head"].(map[string]interface{})
			if headOk {
				branchName, _ := head["ref"].(string)

				ticketID := adapters.ExtractTicketID(branchName)
				if ticketID != "" {
					log.Printf("🔍 [JIRA] Found Ticket [%s] in branch [%s]", ticketID, branchName)

					targetStateName := "In Review" // Default for opened/reopened
					if action == "closed" {
						targetStateName = "Done"
					}

					// 🌟 FIX: Pass the Repo Name so we know WHICH Organization's keys to decrypt!
					repoFullName, _ := payload["repository"].(map[string]interface{})["full_name"].(string)
					go processJiraTransition(ticketID, targetStateName, repoFullName)
				}
			}
		}

	} else if eventType != "installation" {
		c.String(http.StatusOK, "Ignored event type")
		return
	}

	// 4. Push to the Worker Queue!
	fmt.Printf("\n📥 Received Valid GitHub Event: [%s] | Delivery ID: [%s]\n", eventType, deliveryID)

	queueJob := map[string]interface{}{
		"deliveryId": deliveryID,
		"eventType":  eventType,
		"payload":    payload,
	}

	queueJSON, _ := json.Marshal(queueJob)
	redis.Client.LPush(ctx, "tron:v3_secret_queue", queueJSON)

	fmt.Printf("📤 Successfully pushed Delivery ID: [%s] to Redis!\n", deliveryID)

	c.String(http.StatusOK, "Webhook received and queued")
}

// processJiraTransition handles the background communication securely via the Vault
func processJiraTransition(ticketID, targetStateName, repoName string) {
	// 1. Find the Organization that owns this Repository
	var repo models.Repository
	if err := database.DB.Where("repo_name = ?", repoName).First(&repo).Error; err != nil {
		log.Printf("❌ [JIRA] Aborting transition. Could not find repository '%s' in DB.", repoName)
		return
	}

	// Make sure they actually want to use Jira!
	if repo.PMProvider != "jira" {
		return
	}

	// 2. Fetch their encrypted Jira keys from the Vault
	var integration models.Integration
	if err := database.DB.Where("org_id = ? AND provider = 'jira'", repo.OrgID).First(&integration).Error; err != nil {
		log.Printf("❌ [JIRA] Could not find Jira integration keys for Org: %s\n", repo.OrgID)
		return
	}

	if integration.SecretID == nil {
		return
	}

	// 3. Decrypt the keys
	decryptedJSON, err := services.GetDecryptedSecret(*integration.SecretID)
	if err != nil {
		log.Printf("❌ [JIRA] Failed to decrypt Jira keys: %v\n", err)
		return
	}

	var creds map[string]string
	json.Unmarshal([]byte(decryptedJSON), &creds)

	// 4. Boot the Adapter dynamically!
	jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])

	// 5. Execute the Transition
	transitions, err := jiraAPI.GetAvailableTransitions(ticketID)
	if err != nil {
		log.Printf("❌ [JIRA] Failed to pull states for %s: %v\n", ticketID, err)
		return
	}

	var matchedTransitionID string
	for _, t := range transitions {
		// Jira sometimes uses "In Review", "Under Review", or "Review" depending on the board
		name, _ := t["name"].(string)
		if strings.Contains(strings.ToLower(name), strings.ToLower(targetStateName)) {
			matchedTransitionID = t["id"].(string)
			break
		}
	}

	if matchedTransitionID != "" {
		if err := jiraAPI.TransitionIssue(ticketID, matchedTransitionID); err != nil {
			log.Printf("❌ [JIRA] Failed to transition %s to %s: %v\n", ticketID, targetStateName, err)
		} else {
			log.Printf("✅ [JIRA] Automatically moved ticket %s to %s via Webhook!\n", ticketID, targetStateName)
		}
	} else {
		log.Printf("⚠️ [JIRA] Transition to '%s' is not currently allowed or available for ticket %s\n", targetStateName, ticketID)
	}
}
