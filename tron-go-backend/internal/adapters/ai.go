package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"time"
)

// AIAdapter handles communication with OpenRouter
type AIAdapter struct {
	HTTPClient *http.Client
	APIKey     string
	BaseURL    string
	Model      string
}

// ExecutiveSummary matches the exact JSON schema requested by the prompt
type ExecutiveSummary struct {
	Intent           string `json:"intent"`
	ExecutiveSummary string `json:"executive_summary"`
	BusinessImpact   string `json:"business_impact"`
	ConfidenceScore  int    `json:"confidence_score"`
}

// NewAIAdapter initializes the client for OpenRouter
func NewAIAdapter() *AIAdapter {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		fmt.Println("⚠️  Warning: OPENROUTER_API_KEY is not set in environment")
	}

	return &AIAdapter{
		HTTPClient: &http.Client{Timeout: 45 * time.Second}, // 45s timeout for AI generation
		APIKey:     apiKey,
		BaseURL:    "https://openrouter.ai/api/v1/chat/completions",
		Model:      "openrouter/free", // 🌟 Using your specified model
	}
}

// --------------------------------------------------------
// 🛠️ PRIVATE HELPER: Executes the OpenRouter API Call
// --------------------------------------------------------
func (api *AIAdapter) executeChat(messages []map[string]string, temperature float64) (string, error) {
	if api.APIKey == "" {
		return "", fmt.Errorf("OPENROUTER_API_KEY is missing")
	}

	payload := map[string]interface{}{
		"model":       api.Model,
		"messages":    messages,
		"temperature": temperature,
	}
	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", api.BaseURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return "", err
	}

	// 🌟 OpenRouter Required Headers
	req.Header.Set("Authorization", "Bearer "+api.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("HTTP-Referer", "http://localhost:3000")
	req.Header.Set("X-Title", "T.R.O.N. Local Watcher")

	resp, err := api.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("AI network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("OpenRouter API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode AI response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("OpenRouter returned an empty response")
	}

	return result.Choices[0].Message.Content, nil
}

// --------------------------------------------------------
// 1. THE INTELLIGENCE ENGINE (JSON)
// --------------------------------------------------------
func (api *AIAdapter) GenerateExecutiveSummary(prTitle, sanitizedDiff string) (ExecutiveSummary, error) {
	// QoL UPDATE: Don't waste AI credits on empty diffs
	if sanitizedDiff == "" {
		return ExecutiveSummary{
			Intent:           "Infrastructure",
			ExecutiveSummary: "Automated updates to lockfiles, generated assets, or ignored files.",
			BusinessImpact:   "No direct user impact. Routine maintenance.",
			ConfidenceScore:  100,
		}, nil
	}

	systemPrompt := `You are an elite Staff Software Engineer translating technical code changes into business intelligence.
Read the provided Git diff and summarize exactly what changed and why it matters.

RULES:
1. Do not use overly technical jargon.
2. Focus on the business value.
3. You MUST respond in pure, raw JSON format matching the exact structure below.

JSON STRUCTURE:
{
	"intent": "Feature" | "Bug Fix" | "Refactoring" | "Infrastructure",
	"executive_summary": "A 2-3 sentence human-readable summary of the changes.",
	"business_impact": "A 1 sentence explanation of how this affects the user.",
	"confidence_score": 95
}`

	userPrompt := fmt.Sprintf("PR Title: %s\n\nCode Diff:\n%s", prTitle, sanitizedDiff)

	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": userPrompt},
	}

	rawContent, err := api.executeChat(messages, 0.1)
	if err != nil {
		return ExecutiveSummary{}, err
	}

	// 🛡️ Regex extraction to handle markdown wrappers (e.g. ```json ... ```)
	re := regexp.MustCompile(`\{[\s\S]*\}`)
	jsonMatch := re.FindString(rawContent)
	if jsonMatch == "" {
		return ExecutiveSummary{}, fmt.Errorf("AI did not return a valid JSON structure")
	}

	var summary ExecutiveSummary
	if err := json.Unmarshal([]byte(jsonMatch), &summary); err != nil {
		return ExecutiveSummary{}, fmt.Errorf("failed to parse AI JSON: %w", err)
	}

	return summary, nil
}

// --------------------------------------------------------
// 2. THE CODE REVIEWER ENGINE (MARKDOWN)
// --------------------------------------------------------
func (api *AIAdapter) GenerateCodeReview(sanitizedDiff string) string {
	if sanitizedDiff == "" {
		return "✅ **No code changes detected.**"
	}

	reviewPrompt := `You are a strict, senior software engineer performing a technical code review.
Review the following Git diff for logic errors, security vulnerabilities, or performance bottlenecks.

RULES:
1. If the code is perfect, respond ONLY with: "✅ **Code looks solid.** No major issues detected by T.R.O.N."
2. If there are issues, list them using Markdown bullet points. 
3. Be direct, technical, and helpful. Use code blocks for suggestions.
4. Limit your response to the top 3 most critical findings.`

	messages := []map[string]string{
		{"role": "system", "content": reviewPrompt},
		{"role": "user", "content": fmt.Sprintf("Code Diff:\n%s", sanitizedDiff)},
	}

	response, err := api.executeChat(messages, 0.3)
	if err != nil {
		fmt.Printf("❌ Code Review Failed: %v\n", err)
		return "⚠️ T.R.O.N. was unable to generate a code review due to a technical error."
	}

	return response
}

// --------------------------------------------------------
// 3. THE TASK SUGGESTION ENGINE (JSON ARRAY)
// --------------------------------------------------------
func (api *AIAdapter) GenerateTaskSuggestions(diffData string) []string {
	fallback := []string{"Implement new feature", "Refactor codebase", "Fix code issue"}

	if diffData == "" {
		return fallback
	}

	prompt := fmt.Sprintf(`You are a Senior Technical Product Manager. A developer is currently writing some code, but they haven't created a ticket for it yet.
Look at the following raw, uncommitted code diff and suggest 3 short, actionable task titles (under 8 words each) that accurately describe what the developer is building.

RULES:
1. Start each task with a strong action verb (e.g., Implement, Fix, Add, Refactor).
2. Keep them short and professional.
3. You MUST respond in pure JSON format as an array of exactly 3 strings. Do not add markdown or extra text.

Code Diff:
%s`, diffData)

	messages := []map[string]string{
		{"role": "user", "content": prompt},
	}

	rawContent, err := api.executeChat(messages, 0.4)
	if err != nil {
		fmt.Printf("❌ Task Suggestion Failed: %v\n", err)
		return fallback
	}

	// 🛡️ Regex to extract the JSON Array
	re := regexp.MustCompile(`\[[\s\S]*\]`)
	jsonMatch := re.FindString(rawContent)
	if jsonMatch == "" {
		return fallback
	}

	var suggestions []string
	if err := json.Unmarshal([]byte(jsonMatch), &suggestions); err != nil {
		return fallback
	}

	// Ensure we return at most 3 elements
	if len(suggestions) > 3 {
		return suggestions[:3]
	}
	return suggestions
}
