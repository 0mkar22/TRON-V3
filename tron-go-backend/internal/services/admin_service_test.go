package services_test

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tron-v3.1/tron-go-backend/internal/services"
)

func TestRemoveDeveloperService_CannotRemoveSelf(t *testing.T) {
	msg, err, status := services.RemoveDeveloperService("user123", "org123", "user123")
	assert.Error(t, err)
	assert.Equal(t, "you cannot remove yourself from the team", err.Error())
	assert.Equal(t, "", msg)
	assert.Equal(t, http.StatusBadRequest, status)
}
