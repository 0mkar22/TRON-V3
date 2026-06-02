package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
)

// CommunicationConfig maps the JSON settings from the database
type CommunicationConfig struct {
	Provider   string `json:"provider"`
	WebhookURL string `json:"webhook_url"`
	ChannelID  string `json:"channel_id"`
	BotToken   string `json:"bot_token"`
}

// AIReport standardizes the AI output so the messenger doesn't care which LLM generated it
type AIReport struct {
	Intent           string
	ExecutiveSummary string
	BusinessImpact   string
}

// MessengerAdapter handles broadcasting to team communication channels
type MessengerAdapter struct {
	HTTPClient *http.Client
}

// NewMessengerAdapter initializes the client with a standard timeout
func NewMessengerAdapter() *MessengerAdapter {
	return &MessengerAdapter{
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// BroadcastSummary routes the message to the correct platform
func (api *MessengerAdapter) BroadcastSummary(config CommunicationConfig, prTitle, prURL string, report AIReport, orgID string) {
	if config.Provider == "" {
		return
	}

	switch config.Provider {
	case "discord":
		if config.WebhookURL == "" {
			fmt.Println("❌ [Messenger] Missing webhook_url for Discord")
			return
		}
		api.sendDiscord(config.WebhookURL, prTitle, prURL, report)

	case "discord_bot":
		if config.ChannelID == "" || orgID == "" {
			fmt.Println("❌ [Messenger] Missing channel_id or orgId for Discord Bot")
			return
		}
		api.sendDiscordBot(config, prTitle, prURL, report, orgID)

	case "slack":
		if config.WebhookURL == "" {
			fmt.Println("❌ [Messenger] Missing webhook_url for Slack")
			return
		}
		api.sendSlack(config.WebhookURL, prTitle, prURL, report)

	default:
		fmt.Printf("⚠️ [Messenger] Unsupported communication provider: '%s'\n", config.Provider)
	}
}

// ==========================================
// 🌟 The Discord Bot API Route (Smart Vault Fallback)
// ==========================================
func (api *MessengerAdapter) sendDiscordBot(config CommunicationConfig, prTitle, prURL string, report AIReport, orgID string) {
	var integration models.Integration
	actualBotToken := config.BotToken

	// 1. Fetch the integration record from the database
	err := database.DB.Where("org_id = ? AND provider IN ?", orgID, []string{"discord", "discord_bot"}).First(&integration).Error

	// 2. 🌟 THE FIX: Smart Vault Fallback in Go
	if err == nil && integration.SecretID != nil && actualBotToken == "" {
		decryptedSecret, decErr := services.GetDecryptedSecret(*integration.SecretID)

		if decErr == nil && decryptedSecret != "" {
			// Try to parse it as JSON first
			var creds map[string]interface{}
			if parseErr := json.Unmarshal([]byte(decryptedSecret), &creds); parseErr == nil {
				if val, ok := creds["botToken"].(string); ok {
					actualBotToken = val
				} else if val, ok := creds["bot_token"].(string); ok {
					actualBotToken = val
				} else if val, ok := creds["token"].(string); ok {
					actualBotToken = val
				}
			} else {
				// If JSON parsing fails, it means the secret IS the raw token!
				actualBotToken = decryptedSecret
			}
		}
	}

	if actualBotToken == "" {
		fmt.Println("❌ [Messenger] Missing bot_token in database for this organization.")
		return
	}

	url := fmt.Sprintf("https://discord.com/api/v10/channels/%s/messages", config.ChannelID)
	payload := api.buildDiscordPayload(prTitle, prURL, report)
	payloadBytes, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	req.Header.Set("Authorization", "Bot "+actualBotToken)
	req.Header.Set("Content-Type", "application/json")

	resp, reqErr := api.HTTPClient.Do(req)
	if reqErr != nil || resp.StatusCode >= 400 {
		fmt.Printf("❌ [Messenger] Failed to send Discord Bot message. Status: %d\n", resp.StatusCode)
		return
	}
	defer resp.Body.Close()

	fmt.Println("✅ [Messenger] Successfully broadcasted AI Intel via Custom Discord Bot.")
}

// ==========================================
// LEGACY WEBHOOK ROUTES
// ==========================================
func (api *MessengerAdapter) sendDiscord(webhookURL, prTitle, prURL string, report AIReport) {
	payload := api.buildDiscordPayload(prTitle, prURL, report)
	payloadBytes, _ := json.Marshal(payload)

	resp, err := api.HTTPClient.Post(webhookURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil || resp.StatusCode >= 400 {
		fmt.Println("❌ [Messenger] Failed to send Discord Webhook message.")
		return
	}
	defer resp.Body.Close()

	fmt.Println("✅ [Messenger] Successfully broadcasted AI Intel to Discord.")
}

func (api *MessengerAdapter) sendSlack(webhookURL, prTitle, prURL string, report AIReport) {
	// Build Slack Blocks Payload
	payload := map[string]interface{}{
		"blocks": []map[string]interface{}{
			{
				"type": "header",
				"text": map[string]string{"type": "plain_text", "text": "🤖 T.R.O.N. Intel: " + prTitle},
			},
			{
				"type": "section",
				"text": map[string]string{"type": "mrkdwn", "text": fmt.Sprintf("*<%s|View Pull Request>*", prURL)},
			},
			{
				"type": "section",
				"fields": []map[string]string{
					{"type": "mrkdwn", "text": "*🏷️ Category:*\n" + fallbackText(report.Intent, "Unknown")},
					{"type": "mrkdwn", "text": "*📝 Summary:*\n" + fallbackText(report.ExecutiveSummary, "No summary")},
					{"type": "mrkdwn", "text": "*🚀 Business Impact:*\n" + fallbackText(report.BusinessImpact, "No impact")},
				},
			},
		},
	}

	payloadBytes, _ := json.Marshal(payload)

	resp, err := api.HTTPClient.Post(webhookURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil || resp.StatusCode >= 400 {
		fmt.Println("❌ [Messenger] Failed to send Slack Webhook message.")
		return
	}
	defer resp.Body.Close()

	fmt.Println("✅ [Messenger] Successfully broadcasted AI Intel to Slack.")
}

// ==========================================
// PRIVATE HELPERS
// ==========================================

// buildDiscordPayload standardizes the Embed look across Webhooks and Bots
func (api *MessengerAdapter) buildDiscordPayload(prTitle, prURL string, report AIReport) map[string]interface{} {
	return map[string]interface{}{
		"embeds": []map[string]interface{}{
			{
				"title":     "🤖 T.R.O.N. Intel: " + prTitle,
				"url":       prURL,
				"color":     3447003,
				"timestamp": time.Now().UTC().Format(time.RFC3339),
				"footer":    map[string]string{"text": "TRON V3 AI Pipeline"},
				"fields": []map[string]string{
					{"name": "🏷️ Category", "value": fallbackText(report.Intent, "Unknown")},
					{"name": "📝 Summary", "value": fallbackText(report.ExecutiveSummary, "No summary provided.")},
					{"name": "🚀 Business Impact", "value": fallbackText(report.BusinessImpact, "No impact analysis provided.")},
				},
			},
		},
	}
}

// fallbackText ensures we don't send empty fields which cause Discord/Slack APIs to reject the payload
func fallbackText(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
