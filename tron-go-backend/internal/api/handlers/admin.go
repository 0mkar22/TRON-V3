package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
)

// ==========================================
// 1. GITHUB REPOSITORIES (App Secured)
// ==========================================
func GetGitHubRepos(c *gin.Context) {
	orgID := c.GetString("orgId")

	repos, err := services.FetchGitHubRepos(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"repos": repos})
}

// ==========================================
// 5. SECURE DASHBOARD WORKFLOWS
// ==========================================
func GetDashboardWorkflows(c *gin.Context) {
	orgID := c.GetString("orgId")

	workflows, err := services.FetchDashboardWorkflows(orgID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"workflows": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workflows": workflows})
}

// ==========================================
// 6. SECURE SYSTEM STATUS (Mission Control)
// ==========================================
func GetSystemStatus(c *gin.Context) {
	parsedQueue, activeReviews, err := services.FetchSystemStatus()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"queue":       parsedQueue,
		"reviews":     activeReviews,
		"queueCount":  len(parsedQueue),
		"reviewCount": len(activeReviews),
	})
}

// ==========================================
// 7. TEAM MANAGEMENT: INVITE DEVELOPER
// ==========================================
func InviteDeveloper(c *gin.Context) {
	orgID := c.GetString("orgId")

	var body struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A valid email address is required."})
		return
	}

	msg, err, status := services.InviteDeveloperService(orgID, body.Email)
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(status, gin.H{"message": msg})
}

// ==========================================
// 8. TEAM MANAGEMENT: REMOVE DEVELOPER
// ==========================================
func RemoveDeveloper(c *gin.Context) {
	adminOrgID := c.GetString("orgId")
	targetUserID := c.Param("id")

	adminUser, _ := getUserFromToken(c)

	msg, err, status := services.RemoveDeveloperService(adminUser.ID, adminOrgID, targetUserID)
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(status, gin.H{"message": msg})
}

// ==========================================
// 9. LINK REPOSITORY CONFIG
// ==========================================
func LinkRepository(c *gin.Context) {
	var body struct {
		OrgID               string                 `json:"orgId"`
		RepoName            string                 `json:"repoName"`
		PMProvider          string                 `json:"pmProvider"`
		PMProjectID         string                 `json:"pmProjectId"`
		Mapping             map[string]interface{} `json:"mapping"`
		CommunicationConfig map[string]interface{} `json:"communication_config"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	err := services.LinkRepositoryService(body.OrgID, body.RepoName, body.PMProvider, body.PMProjectID, body.Mapping, body.CommunicationConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Repository linked successfully."})
}

// ==========================================
// 10. BASECAMP PROJECTS
// ==========================================
func GetBasecampProjects(c *gin.Context) {
	orgID := c.GetString("orgId")

	projects, err := services.FetchBasecampProjects(orgID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"projects": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"projects": projects})
}

// ==========================================
// 11. DISCORD STATUS
// ==========================================
func GetDiscordStatus(c *gin.Context) {
	orgID := c.GetString("orgId")

	channels, err := services.FetchDiscordStatus(orgID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"channels": []interface{}{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"channels": channels})
}

// ==========================================
// 12. BASECAMP COLUMNS (ULTRA-ROBUST)
// ==========================================
func GetBasecampColumns(c *gin.Context) {
	var body struct {
		ProjectID string `json:"projectId"`
		OrgID     string `json:"orgId"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.ProjectID == "" || body.OrgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing Project ID or Org ID."})
		return
	}

	columns, err, status := services.FetchBasecampColumns(body.OrgID, body.ProjectID)
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(status, gin.H{"columns": columns})
}

// ==========================================
// 13. UNINSTALL GITHUB APP
// ==========================================
func UninstallGitHubApp(c *gin.Context) {
	orgID := c.Query("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing orgId"})
		return
	}

	err, status := services.UninstallGitHubAppService(orgID)
	if err != nil {
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(status, gin.H{"success": true})
}
