package services

import (
	"context"
	"fmt"

	"github.com/tron-v3.1/tron-go-backend/pkg/supabase"
)

// GetDecryptedSecret safely retrieves and decrypts a token from the Supabase Vault
func GetDecryptedSecret(secretID string) (string, error) {
	if secretID == "" {
		return "", fmt.Errorf("secretID cannot be empty")
	}

	var decryptedSecret string
	params := map[string]interface{}{
		"p_secret_id": secretID,
	}

	// 🌟 FIX: Route through .DB and use .Rpc() followed by .ExecuteWithContext()
	err := supabase.Admin.DB.Rpc("get_decrypted_secret", params).ExecuteWithContext(context.Background(), &decryptedSecret)
	if err != nil {
		return "", fmt.Errorf("failed to execute get_decrypted_secret RPC: %w", err)
	}

	if decryptedSecret == "" {
		return "", fmt.Errorf("vault returned an empty string for secret %s", secretID)
	}

	return decryptedSecret, nil
}

// InsertSecret safely stores a new token/credential payload into the Supabase Vault
func InsertSecret(name, description, value string) (string, error) {
	var newSecretID string
	params := map[string]interface{}{
		"secret_name":        name,
		"secret_description": description,
		"secret_value":       value,
	}

	err := supabase.Admin.DB.Rpc("insert_secret", params).ExecuteWithContext(context.Background(), &newSecretID)
	if err != nil {
		return "", fmt.Errorf("failed to insert secret into vault: %w", err)
	}

	return newSecretID, nil
}

// DeleteSecret cleans up old tokens from the Vault to prevent bloat (used during Basecamp refresh)
func DeleteSecret(secretID string) error {
	var result interface{} // RPC might return null, but we still need a pointer to capture the response
	params := map[string]interface{}{
		"p_secret_id": secretID,
	}

	err := supabase.Admin.DB.Rpc("delete_secret", params).ExecuteWithContext(context.Background(), &result)
	if err != nil {
		return fmt.Errorf("failed to delete secret from vault: %w", err)
	}

	return nil
}
