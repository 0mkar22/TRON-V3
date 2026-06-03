package supabase

import (
	"fmt"
	"log"
	"os"

	supa "github.com/nedpals/supabase-go"
)

// Admin is the globally accessible Supabase Service Role client
var Admin *supa.Client

func ConnectSupabase() {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
	}

	Admin = supa.CreateClient(supabaseURL, supabaseKey)
	fmt.Println("✅ Supabase Admin Client Initialized")
}
