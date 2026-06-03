package redis

import (
	"context"
	"fmt"
	"log"
	"os"

	redisClient "github.com/redis/go-redis/v9"
)

var Client *redisClient.Client
var Ctx = context.Background()

func ConnectRedis() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		log.Fatal("REDIS_URL environment variable is not set")
	}

	opt, err := redisClient.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}

	Client = redisClient.NewClient(opt)

	// Ping Redis to ensure connection is alive
	if err := Client.Ping(Ctx).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	fmt.Println("✅ Successfully connected to Redis Queue")
}
