package services_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
)

func TestGetUserFromToken_EmptyToken(t *testing.T) {
	svc := services.NewVSCodeService()
	_, err := svc.GetUserFromToken("")
	assert.Error(t, err)
	assert.Equal(t, "missing or invalid token", err.Error())
}
