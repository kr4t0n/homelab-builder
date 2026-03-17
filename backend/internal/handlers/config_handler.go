package handlers

import (
	"fmt"
	"net/http"

	"github.com/kr4t0n/orbit/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ConfigHandler struct {
	service *services.ConfigService
}

func NewConfigHandler(service *services.ConfigService) *ConfigHandler {
	return &ConfigHandler{
		service: service,
	}
}

func (h *ConfigHandler) GenerateConfig(c *gin.Context) {
	_, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	buildIDStr := c.Param("id")
	buildID, err := uuid.Parse(buildIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid build ID"})
		return
	}

	bundle, err := h.service.GenerateAll(buildID)
	if err != nil {
		fmt.Printf("Config Generate Error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate config bundle"})
		return
	}

	c.JSON(http.StatusOK, bundle)
}
