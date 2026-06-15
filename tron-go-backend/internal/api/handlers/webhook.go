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

	// 3. Filter Events & Inject PM Automation (Jira & Linear)
	if eventType == "pull_request" {
		action, _ := payload["action"].(string)
		if action != "opened" && action != "closed" && action != "reopened" {
			c.String(http.StatusOK, "Ignored pull_request action")
			return
		}

		pr, prOk := payload["pull_request"].(map[string]interface{})
		if prOk {
			head, headOk := pr["head"].(map[string]interface{})
			if headOk {
				branchName, _ := head["ref"].(string)

				ticketID := adapters.ExtractTicketID(branchName)
				if ticketID != "" {
					log.Printf("🔍 [TRON ENGINE] Found Ticket [%s] in branch [%s]", ticketID, branchName)

					// Target synonyms for PR Opened
					targetStateNames := []string{"In Review", "Under Review", "Code Review", "Review"}
					if action == "closed" {
						// Target synonyms for PR Closed/Merged (Added 'Completed' for Linear)
						targetStateNames = []string{"Done", "Closed", "Resolved", "Completed"}
					}

					repoFullName, _ := payload["repository"].(map[string]interface{})["full_name"].(string)

					// Route to the universal transition handler
					go processTicketTransition(ticketID, targetStateNames, repoFullName)
				}
			}
		}

	} else if eventType != "installation" {
		c.String(http.StatusOK, "Ignored event type")
		return
	}

	// 4. Push to the Worker Queue for Basecamp & AI Reviews
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

// processTicketTransition handles background state changes for Jira and Linear
func processTicketTransition(ticketID string, targetStateNames []string, repoName string) {
	// 1. Find the Organization that owns this Repository
	var repo models.Repository
	if err := database.DB.Where("repo_name = ?", repoName).First(&repo).Error; err != nil {
		log.Printf("❌ [TRON ENGINE] Aborting transition. Could not find repository '%s' in DB.", repoName)
		return
	}

	// ==========================================
	// JIRA WORKFLOW
	// ==========================================
	if repo.PMProvider == "jira" {
		var integration models.Integration
		if err := database.DB.Where("org_id = ? AND provider = 'jira'", repo.OrgID).First(&integration).Error; err != nil || integration.SecretID == nil {
			return
		}

		decryptedJSON, err := services.GetDecryptedSecret(*integration.SecretID)
		if err != nil {
			return
		}

		var creds map[string]string
		json.Unmarshal([]byte(decryptedJSON), &creds)

		jiraAPI := adapters.NewJiraAdapter(creds["baseUrl"], creds["email"], creds["apiToken"])
		transitions, err := jiraAPI.GetAvailableTransitions(ticketID)
		if err != nil {
			return
		}

		var matchedTransitionID, finalColumnName string
		for _, t := range transitions {
			name, _ := t["name"].(string)
			for _, allowedName := range targetStateNames {
				if strings.Contains(strings.ToLower(name), strings.ToLower(allowedName)) {
					matchedTransitionID = t["id"].(string)
					finalColumnName = name
					break
				}
			}
			if matchedTransitionID != "" {
				break
			}
		}

		if matchedTransitionID != "" {
			if err := jiraAPI.TransitionIssue(ticketID, matchedTransitionID); err == nil {
				log.Printf("✅ [JIRA] Automatically moved ticket %s to %s via Webhook!\n", ticketID, finalColumnName)
			}
		} else {
			log.Printf("⚠️ [JIRA] Transition to %v is not available for ticket %s\n", targetStateNames, ticketID)
		}

		// ==========================================
		// LINEAR WORKFLOW
		// ==========================================
	} else if repo.PMProvider == "linear" {
		var integration models.Integration
		if err := database.DB.Where("org_id = ? AND provider = 'linear'", repo.OrgID).First(&integration).Error; err != nil || integration.SecretID == nil {
			return
		}

		decryptedJSON, err := services.GetDecryptedSecret(*integration.SecretID)
		if err != nil {
			return
		}

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

		// "TRO-5" -> "TRO"
		parts := strings.Split(ticketID, "-")
		if len(parts) != 2 {
			return
		}
		teamKey := parts[0]

		states, err := linearAPI.GetAvailableStates(teamKey)
		if err != nil {
			log.Printf("❌ [LINEAR] Failed to pull states: %v\n", err)
			return
		}

		var matchedTransitionID, finalColumnName string
		for _, s := range states {
			name, _ := s["name"].(string)
			for _, allowedName := range targetStateNames {
				if strings.Contains(strings.ToLower(name), strings.ToLower(allowedName)) {
					matchedTransitionID, _ = s["id"].(string)
					finalColumnName = name
					break
				}
			}
			if matchedTransitionID != "" {
				break
			}
		}

		if matchedTransitionID != "" {
			if err := linearAPI.TransitionIssue(ticketID, matchedTransitionID); err == nil {
				log.Printf("✅ [LINEAR] Automatically moved ticket %s to %s via Webhook!\n", ticketID, finalColumnName)
			} else {
				log.Printf("❌ [LINEAR] Failed to transition: %v\n", err)
			}
		} else {
			log.Printf("⚠️ [LINEAR] Transition to %v is not available for ticket %s\n", targetStateNames, ticketID)
		}
	}
}
