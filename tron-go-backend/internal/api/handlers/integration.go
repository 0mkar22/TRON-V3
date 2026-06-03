package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/supabase"
)

// ==========================================
// 1. GENERIC INTEGRATION SETUP (GitHub/Jira/Monday)
// ==========================================
func SetupIntegration(c *gin.Context) {
	var body struct {
		OrgID    string `json:"orgId"`
		Provider string `json:"provider"`
		Token    string `json:"token"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || body.OrgID == "" || body.Provider == "" || body.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing orgId, provider, or token"})
		return
	}

	var secretID string
	params := map[string]interface{}{
		"p_org_id":   body.OrgID,
		"p_provider": body.Provider,
		"p_token":    body.Token,
	}

	// Execute the custom Supabase RPC
	err := supabase.Admin.DB.Rpc("store_integration_token", params).ExecuteWithContext(context.Background(), &secretID)
	if err != nil {
		fmt.Printf("❌ [Integrations] Failed to setup %s: %v\n", body.Provider, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure integration token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("%s integration secured successfully.", body.Provider),
		"integration_id": secretID,
	})
}

// ==========================================
// 2. BASECAMP OAUTH: INITIALIZATION
// ==========================================
func InitBasecampAuth(c *gin.Context) {
	var body struct {
		AccountID    string `json:"accountId"`
		ClientID     string `json:"clientId"`
		ClientSecret string `json:"clientSecret"`
		OrgID        string `json:"orgId"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || body.AccountID == "" || body.OrgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing Basecamp credentials or Org ID"})
		return
	}

	fmt.Printf("👉 Starting Basecamp auth for Org: %s\n", body.OrgID)

	pendingData, _ := json.Marshal(map[string]string{
		"accountId":    body.AccountID,
		"clientId":     body.ClientID,
		"clientSecret": body.ClientSecret,
	})

	// 1. Store the pending credentials in the Vault
	secretName := fmt.Sprintf("basecamp_pending_%s_%d", body.OrgID, time.Now().Unix())
	secretID, err := services.InsertSecret(secretName, "Pending OAuth keys for Basecamp", string(pendingData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Vault Error: Failed to secure pending keys"})
		return
	}

	// 2. Upsert the pending integration state using GORM
	integration := models.Integration{
		OrgID:    body.OrgID,
		Provider: "basecamp_pending",
		SecretID: &secretID,
	}
	database.DB.Save(&integration) // Upserts based on primary keys/constraints

	// 3. Generate the 37signals Redirect URL
	redirectURI := url.QueryEscape("https://tron-v3-1.onrender.com/api/auth/basecamp/callback")
	stateParam := url.QueryEscape(body.OrgID) // Pass OrgID through the state parameter
	authURL := fmt.Sprintf("https://launchpad.37signals.com/authorization/new?type=web_server&client_id=%s&redirect_uri=%s&state=%s", body.ClientID, redirectURI, stateParam)

	c.JSON(http.StatusOK, gin.H{"success": true, "redirectUrl": authURL})
}

// ==========================================
// 3. BASECAMP OAUTH: CALLBACK (The Token Exchange)
// ==========================================
func BasecampCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing authorization code or state"})
		return
	}

	returnedOrgID, _ := url.QueryUnescape(state)
	fmt.Printf("👉 Catching Basecamp redirect for Org: %s\n", returnedOrgID)

	// 1. Find the pending credentials in GORM
	var pendingInt models.Integration
	if err := database.DB.Where("provider = ? AND org_id = ?", "basecamp_pending", returnedOrgID).First(&pendingInt).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not find pending credentials"})
		return
	}

	// 2. Decrypt the pending Client ID & Secret
	decryptedJSON, err := services.GetDecryptedSecret(*pendingInt.SecretID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt pending credentials"})
		return
	}

	var creds map[string]string
	json.Unmarshal([]byte(decryptedJSON), &creds)

	// 3. Exchange the Code for an Access Token at 37signals
	redirectURI := url.QueryEscape("https://tron-v3-1.onrender.com/api/auth/basecamp/callback")
	tokenURL := fmt.Sprintf("https://launchpad.37signals.com/authorization/token?type=web_server&client_id=%s&redirect_uri=%s&client_secret=%s&code=%s", creds["clientId"], redirectURI, creds["clientSecret"], code)

	resp, err := http.Post(tokenURL, "application/json", nil)
	if err != nil || resp.StatusCode >= 400 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange code for tokens"})
		return
	}
	defer resp.Body.Close()

	var tokenData struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	json.NewDecoder(resp.Body).Decode(&tokenData)

	// 4. Save the active tokens to the Vault
	finalCredentials, _ := json.Marshal(map[string]interface{}{
		"accountId":    creds["accountId"],
		"clientId":     creds["clientId"],
		"clientSecret": creds["clientSecret"],
		"accessToken":  tokenData.AccessToken,
		"refreshToken": tokenData.RefreshToken,
		"expiresAt":    time.Now().UnixMilli() + int64(tokenData.ExpiresIn*1000),
	})

	finalSecretName := fmt.Sprintf("basecamp_active_%s_%d", returnedOrgID, time.Now().Unix())
	finalSecretID, _ := services.InsertSecret(finalSecretName, "Active OAuth keys for Basecamp", string(finalCredentials))

	// 5. Upsert the Active Integration and Clean Up
	activeInt := models.Integration{
		OrgID:    returnedOrgID,
		Provider: "basecamp",
		SecretID: &finalSecretID,
	}
	database.DB.Save(&activeInt)

	database.DB.Where("provider = ? AND org_id = ?", "basecamp_pending", returnedOrgID).Delete(&models.Integration{})
	services.DeleteSecret(*pendingInt.SecretID) // Clean up Vault bloat

	fmt.Println("🎉 All done! Sending success redirect.")
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3001"
	}
	c.Redirect(http.StatusFound, frontendURL+"/integrations")
}
