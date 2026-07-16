package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// SlackAdapter handles communication with the Slack API
type SlackAdapter struct {
	HTTPClient *http.Client
}

// NewSlackAdapter creates a new instance of the Slack adapter
func NewSlackAdapter() *SlackAdapter {
	return &SlackAdapter{
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SlackMessage represents a basic payload sent to a Slack Webhook
type SlackMessage struct {
	Text string `json:"text"`
	// You can add more fields here later like 'Blocks' for rich text formatting
}

// SendWebhookMessage sends a simple text message to a provided Slack Webhook URL
func (s *SlackAdapter) SendWebhookMessage(webhookURL string, message string) error {
	payload := SlackMessage{
		Text: message,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal slack payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to create slack request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send message to slack: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("slack returned non-200 status code: %d", resp.StatusCode)
	}

	return nil
}
