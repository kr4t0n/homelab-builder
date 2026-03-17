package handlers

import (
	"net/http"

	"github.com/kr4t0n/orbit/backend/internal/middleware"
	"github.com/kr4t0n/orbit/backend/internal/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	service     *services.AuthService
	rateLimiter *middleware.RateLimiter
}

func NewAuthHandler(service *services.AuthService, rateLimiter *middleware.RateLimiter) *AuthHandler {
	return &AuthHandler{
		service:     service,
		rateLimiter: rateLimiter,
	}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input services.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid payload. Email, password (min 8 chars), and name are required.",
			"code":  "invalid_payload",
		})
		return
	}

	result, err := h.service.Register(input)
	if err != nil {
		if err.Error() == "email already registered" {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Email already registered",
				"code":  "email_taken",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Registration failed",
			"code":  "registration_failed",
		})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *AuthHandler) Login(c *gin.Context) {
	ip := c.ClientIP()

	var input services.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.rateLimiter.RecordFailure(ip)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid payload. Email and password are required.",
			"code":  "invalid_payload",
		})
		return
	}

	result, err := h.service.Login(input)
	if err != nil {
		locked := h.rateLimiter.RecordFailure(ip)
		if locked {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid credentials",
				"code":  "invalid_credentials",
			})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid credentials",
			"code":  "invalid_credentials",
		})
		return
	}

	h.rateLimiter.ClearAttempts(ip)
	c.JSON(http.StatusOK, result)
}

func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userID, ok := userIDStr.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user session"})
		return
	}

	user, err := h.service.GetCurrentUser(userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdatePreferences(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	userID, ok := userIDStr.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user session"})
		return
	}

	var input struct {
		Preferences map[string]interface{} `json:"preferences" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Preferences mapping is required"})
		return
	}

	user, err := h.service.UpdatePreferences(userID, input.Preferences)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}
