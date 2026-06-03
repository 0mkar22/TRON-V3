package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateAppJWT creates the RS256 JWT required to authenticate as the GitHub App
func GenerateAppJWT() (string, error) {
	appID := os.Getenv("GITHUB_APP_ID")
	privateKeyEnv := os.Getenv("GITHUB_PRIVATE_KEY")

	if appID == "" || privateKeyEnv == "" {
		return "", fmt.Errorf("missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY")
	}

	// 🌟 FIX: Safely handle newline characters stored in environment variables
	privateKeyEnv = strings.ReplaceAll(privateKeyEnv, "\\n", "\n")

	// Parse the RSA private key
	key, err := jwt.ParseRSAPrivateKeyFromPEM([]byte(privateKeyEnv))
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// Create the Claims (Handling clock drift by issuing 60 seconds in the past)
	claims := jwt.MapClaims{
		"iat": time.Now().Unix() - 60,
		"exp": time.Now().Add(10 * time.Minute).Unix(),
		"iss": appID,
	}

	// Create and sign the token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(key)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signedToken, nil
}

// GetInstallationToken exchanges the App JWT for a temporary GitHub Installation Access Token
func GetInstallationToken(installationID string) (string, error) {
	if installationID == "" {
		return "", fmt.Errorf("missing installation ID")
	}

	// 1. Generate our Master App JWT
	appJWT, err := GenerateAppJWT()
	if err != nil {
		return "", err
	}

	// 2. Request the temporary Installation Token
	url := fmt.Sprintf("https://api.github.com/app/installations/%s/access_tokens", installationID)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+appJWT)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	// 3. Execute the request securely
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to request installation token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("github API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	// 4. Decode the response to grab the token string
	var result struct {
		Token string `json:"token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Token, nil
}
