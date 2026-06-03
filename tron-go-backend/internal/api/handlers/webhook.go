package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
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
		// Return 200 OK immediately so GitHub doesn't retry, but don't process it again
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

	// 3. Filter Events (We only care about PRs and App Installations to save Redis memory)
	if eventType == "pull_request" {
		action, _ := payload["action"].(string)
		if action != "opened" && action != "closed" && action != "reopened" {
			c.String(http.StatusOK, "Ignored pull_request action")
			return
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
