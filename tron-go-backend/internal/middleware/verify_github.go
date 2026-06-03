package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func VerifyGitHub() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := os.Getenv("GITHUB_WEBHOOK_SECRET")
		signature := c.GetHeader("x-hub-signature-256")

		if signature == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Missing signature"})
			return
		}

		// Read the raw body for hash calculation, then put it back for the next handler
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Cannot read body"})
			return
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// Calculate HMAC
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(bodyBytes)
		expectedMAC := hex.EncodeToString(mac.Sum(nil))
		expectedSignature := "sha256=" + expectedMAC

		if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Signature mismatch"})
			return
		}

		c.Next()
	}
}
