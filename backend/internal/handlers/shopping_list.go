package handlers

import (
	"net/http"

	"github.com/kr4t0n/orbit/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type ShoppingListHandler struct {
	service *services.ShoppingListService
}

func NewShoppingListHandler(service *services.ShoppingListService) *ShoppingListHandler {
	return &ShoppingListHandler{service: service}
}

func (h *ShoppingListHandler) Generate(c *gin.Context) {
	var req services.ShoppingListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recommendation_id is required"})
		return
	}

	result, err := h.service.Generate(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
