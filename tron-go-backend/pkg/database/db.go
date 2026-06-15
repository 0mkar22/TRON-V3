package database

import (
	"fmt"
	"log"
	"os"

	// Make sure this matches the module name you used in 'go mod init'
	"github.com/tron-v3.1/tron-go-backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func ConnectDB() {
	// 1. Grab the Supabase connection string from your .env file
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// 2. Open the connection using GORM - CONFIGURED FOR SUPABASE POOLER
	var err error
	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true, // Disables implicit prepared statement usage (fixes Supabase pooler issues)
	}), &gorm.Config{
		PrepareStmt: false, // Ensure prepared statements are strictly off
		Logger:      logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v\n", err)
	}

	fmt.Println("✅ Successfully connected to Supabase PostgreSQL via GORM")

	// 3. AutoMigrate the schema
	// GORM will check the Supabase tables and ensure they match our Go structs
	err = DB.AutoMigrate(
		&models.Organization{},
		&models.Integration{},
		&models.User{},
		&models.Repository{},
		&models.Workflow{},
		&models.ProjectAssignment{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database structures: %v\n", err)
	}

	fmt.Println("✅ Database schema is fully synced!")
}
