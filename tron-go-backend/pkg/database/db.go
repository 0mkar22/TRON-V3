package database

import (
	"os"

	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"github.com/tron-v3.1/tron-go-backend/pkg/logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger" // Aliased to avoid clashing with our custom logger
)

var DB *gorm.DB

func ConnectDB() {
	// 1. Grab the Supabase connection string from your .env file
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		logger.Log.Fatal("DATABASE_URL environment variable is not set")
	}

	// 2. Open the connection using GORM - CONFIGURED FOR SUPABASE POOLER
	var err error
	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Disables implicit prepared statement usage (fixes Supabase pooler issues)
	}), &gorm.Config{
		PrepareStmt: false, // Ensure prepared statements are strictly off
		Logger:      gormlogger.Default.LogMode(gormlogger.Info),
	})

	if err != nil {
		logger.Log.Fatalf("Failed to connect to database: %v", err)
	}

	logger.Log.Info("✅ Successfully connected to Supabase PostgreSQL via GORM")

	// 3. AutoMigrate the schema - SAFETY LOCK APPLIED
	// GORM will check the Supabase tables and ensure they match our Go structs
	if os.Getenv("GIN_MODE") != "release" {
		logger.Log.Info("🛠️ Running AutoMigrate for local development...")

		err = DB.AutoMigrate(
			&models.Organization{},
			&models.Integration{},
			&models.User{},
			&models.Repository{},
			&models.Workflow{},
			&models.ProjectAssignment{},
		)

		if err != nil {
			logger.Log.Fatalf("❌ Failed to migrate database structures: %v", err)
		}

		logger.Log.Info("✅ Database schema is fully synced!")
	} else {
		logger.Log.Info("🔒 Production Mode: Skipping AutoMigrate (Schema locked).")
	}
}
