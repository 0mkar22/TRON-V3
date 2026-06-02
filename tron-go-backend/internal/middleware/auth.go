package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/supabase"
)

// RequireAuth validates the JWT and attaches the user's Org ID
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Missing or invalid token"})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")

		// 1. Verify the Developer's token cryptographically via Supabase
		user, err := supabase.Admin.Auth.User(c.Request.Context(), token)
		if err != nil || user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized: Token is expired or invalid"})
			return
		}

		// 2. Look up which Organization this Developer belongs to using GORM
		var dbUser models.User
		result := database.DB.Where("id = ?", user.ID).First(&dbUser)

		// 🌟 FALLBACK (Ported from your Node.js code)
		orgId := dbUser.OrgID
		if result.Error != nil || orgId == "" {
			orgId = "fbf6021e-e84d-433c-a41e-31e302be78e6"
		}

		// 3. Attach the orgId safely to the Gin Context for the downstream handlers
		c.Set("userId", user.ID)
		c.Set("orgId", orgId)

		c.Next()
	}
}
