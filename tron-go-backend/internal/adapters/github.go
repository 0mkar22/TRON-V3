package adapters

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/tron-v3.1/tron-go-backend/internal/services"
)

type GitHubAdapter struct {
	HTTPClient *http.Client
}

func NewGitHubAdapter() *GitHubAdapter {
	return &GitHubAdapter{
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// FetchAndSanitizeDiff fetches the raw code and runs the DLP / Secret Scrubber (REQ-9 & 10)
func (api *GitHubAdapter) FetchAndSanitizeDiff(repoFullName string, prNumber int, installationID string) (string, error) {
	fmt.Printf("\n📥 [GITHUB ADAPTER] Fetching raw code diff for PR #%d\n", prNumber)

	token, err := services.GetInstallationToken(installationID)
	if err != nil {
		return "", fmt.Errorf("failed to get github token: %w", err)
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/pulls/%d", repoFullName, prNumber)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3.diff")
	req.Header.Set("User-Agent", "TRON-AI-Pipeline")

	resp, err := api.HTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	diffBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	rawDiff := string(diffBytes)
	fmt.Println("🧹 [GITHUB ADAPTER] Sanitizing Monster Diffs...")

	// 1. Remove Lockfiles, SVGs, and Minified files safely by splitting the diff per file
	fileChunks := strings.Split(rawDiff, "diff --git")
	var cleanDiffBuilder strings.Builder

	for _, chunk := range fileChunks {
		if chunk == "" {
			continue
		}

		// If it's a lockfile or minified file, drop the entire chunk
		if strings.Contains(chunk, "package-lock.json") ||
			strings.Contains(chunk, "yarn.lock") ||
			strings.Contains(chunk, ".min.js") ||
			strings.Contains(chunk, ".svg") ||
			strings.Contains(chunk, ".map") {
			continue
		}

		cleanDiffBuilder.WriteString("diff --git")
		cleanDiffBuilder.WriteString(chunk)
	}

	sanitizedDiff := cleanDiffBuilder.String()
	originalLength := len(sanitizedDiff)

	// 2. The Secret Scrubber (DLP)
	awsRe := regexp.MustCompile(`(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}`)
	sshRe := regexp.MustCompile(`(?s)-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----.*?-----END \1 PRIVATE KEY-----`)
	genericRe := regexp.MustCompile(`(?i)(password|secret|api_key|access_token|client_secret)[ \t]*[:=][ \t]*['"]?[^\s'"]+['"]?`)

	sanitizedDiff = awsRe.ReplaceAllString(sanitizedDiff, "[REDACTED_SECRET]")
	sanitizedDiff = sshRe.ReplaceAllString(sanitizedDiff, "[REDACTED_SECRET]")
	sanitizedDiff = genericRe.ReplaceAllString(sanitizedDiff, "[REDACTED_SECRET]")

	if len(sanitizedDiff) != originalLength {
		fmt.Println("🚨 [GITHUB ADAPTER] WARNING: Secrets detected and redacted from PR diff!")
	}

	// 3. Enforce Hard Token Limits (12,000 chars)
	const maxChars = 12000
	if len(sanitizedDiff) > maxChars {
		fmt.Printf("⚠️ [GITHUB ADAPTER] Diff exceeds %d characters. Truncating to protect LLM limit.\n", maxChars)
		sanitizedDiff = sanitizedDiff[:maxChars] + "\n\n... [DIFF TRUNCATED BY T.R.O.N. DUE TO LENGTH] ..."
	}

	fmt.Printf("✅ [GITHUB ADAPTER] Diff sanitized. Final length: %d characters.\n", len(sanitizedDiff))
	return sanitizedDiff, nil
}

// PostPullRequestComment adds the AI review to the PR
func (api *GitHubAdapter) PostPullRequestComment(repoFullName string, prNumber int, commentBody, installationID string) error {
	token, err := services.GetInstallationToken(installationID)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/issues/%d/comments", repoFullName, prNumber)
	payload := map[string]string{"body": commentBody}
	payloadBytes, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "TRON-AI-Pipeline")

	resp, err := api.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("failed to post comment, status: %d", resp.StatusCode)
	}

	fmt.Printf("💬 Successfully posted AI review to PR #%d\n", prNumber)
	return nil
}
