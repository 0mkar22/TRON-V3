package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	// Make sure this path matches your actual module structure
	"github.com/tron-v3.1/tron-go-backend/internal/adapters"
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

					// Determine the Jira target state based on the GitHub action
					targetStateName := "In Review" // Default for opened/reopened
					if action == "closed" {
						// Note: If PR is closed but not merged, you might want logic to handle that differently
						targetStateName = "Done"
					}

					// Fire the Jira transition in a background Goroutine so we don't block the webhook!
					go processJiraTransition(ticketID, targetStateName)
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

// processJiraTransition handles the background communication with Atlassian
func processJiraTransition(ticketID, targetStateName string) {
	jira := adapters.NewJiraAdapter(
		os.Getenv("JIRA_BASE_URL"),
		os.Getenv("JIRA_EMAIL"),
		os.Getenv("JIRA_API_TOKEN"),
	)

	transitions, err := jira.GetAvailableTransitions(ticketID)
	if err != nil {
		log.Printf("❌ [JIRA] Failed to pull states for %s: %v\n", ticketID, err)
		return
	}

	var matchedTransitionID string
	for _, t := range transitions {
		if name, ok := t["name"].(string); ok && name == targetStateName {
			matchedTransitionID = t["id"].(string)
			break
		}
	}

	if matchedTransitionID != "" {
		if err := jira.TransitionIssue(ticketID, matchedTransitionID); err != nil {
			log.Printf("❌ [JIRA] Failed to transition %s to %s: %v\n", ticketID, targetStateName, err)
		}
	} else {
		log.Printf("⚠️ [JIRA] Transition to '%s' is not currently allowed or available for ticket %s\n", targetStateName, ticketID)
	}
}
