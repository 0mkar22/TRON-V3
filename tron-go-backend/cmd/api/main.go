package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/tron-v3.1/tron-go-backend/internal/api/handlers"
	"github.com/tron-v3.1/tron-go-backend/internal/middleware"

	"github.com/tron-v3.1/tron-go-backend/internal/worker"

	"github.com/tron-v3.1/tron-go-backend/pkg/database"
	"github.com/tron-v3.1/tron-go-backend/pkg/redis"
	"github.com/tron-v3.1/tron-go-backend/pkg/supabase"
)

func main() {
	// 1. Environment & Infrastructure Init
	if err := godotenv.Load(); err != nil {
		log.Println("ℹ️ No .env file found (relying on system environment variables)")
	}

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	log.Println("🚀 Booting T.R.O.N. V3 API Gateway...")
	database.ConnectDB()
	redis.ConnectRedis()
	supabase.ConnectSupabase()

	// 2. Configure Gin Router with Production Middleware
	r := gin.New()
	r.Use(gin.Logger())   // Standardized logging
	r.Use(gin.Recovery()) // Prevents panics from crashing the server

	// CORS Setup for VS Code and Next.js Dashboard
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, x-api-key")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 3. Health & Webhook Routes
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "active", "database": "connected", "engine": "TRON V3.1 (Go/Gin)"})
	})
	r.POST("/webhook", middleware.VerifyGitHub(), handlers.HandleGitHubWebhook)

	// 4. Public / Utility Routes
	r.GET("/api/auth/basecamp/callback", handlers.BasecampCallback)
	r.GET("/api/logs/stream", handlers.StreamLogs)
	r.POST("/api/discord/channels", handlers.FetchDiscordChannels)

	// 5. Daemon API (Secured via Headers in Handler)
	r.GET("/api/projects", handlers.GetProjects)

	// 6. Protected Routes (Secured via Supabase JWT)
	api := r.Group("/api")
	api.Use(middleware.RequireAuth())
	{
		// Admin / Dashboard endpoints
		api.GET("/admin/github-repos", handlers.GetGitHubRepos)
		api.GET("/admin/dashboard-workflows", handlers.GetDashboardWorkflows)
		api.GET("/admin/system-status", handlers.GetSystemStatus)
		api.POST("/admin/invite-developer", handlers.InviteDeveloper)
		api.DELETE("/admin/team/:id", handlers.RemoveDeveloper)

		// 🔌 Integrations
		api.POST("/integrations/setup", handlers.SetupIntegration)
		api.POST("/auth/basecamp/init", handlers.InitBasecampAuth)
		api.POST("/integrations/jira", handlers.SaveJiraIntegration) // 🌟 ADDED: Jira setup endpoint

		api.POST("/repositories", handlers.LinkRepository)
		api.GET("/admin/basecamp-projects", handlers.GetBasecampProjects)
		api.GET("/admin/discord-status", handlers.GetDiscordStatus)
		api.POST("/admin/basecamp-columns", handlers.GetBasecampColumns)
		api.DELETE("/admin/github-uninstall", handlers.UninstallGitHubApp)

		// VS Code Endpoints
		api.GET("/project/tickets", handlers.GetTickets)
		api.POST("/suggest-tasks", handlers.SuggestTasks)
		api.POST("/create-task", handlers.CreateTask)
		api.POST("/start-task", handlers.StartTask)
		api.GET("/review/:taskId", handlers.FetchAIReview)
	}

	// 7. Graceful Shutdown Server Configuration
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// 🌟 THE MAGIC: Create a context and spin up the worker in a Goroutine!
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	go worker.Start(workerCtx)

	// Spin up server in a background goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Server failed: %s\n", err)
		}
	}()
	log.Printf("🌐 API Gateway listening at http://localhost:%s\n", port)

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down API Gateway...")

	// 🌟 Safely tell the worker to stop pulling from Redis
	cancelWorker()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("❌ Server forced to shutdown: ", err)
	}

	log.Println("✅ API Gateway exiting cleanly.")
}
