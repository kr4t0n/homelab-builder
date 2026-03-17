package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/kr4t0n/orbit/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type RecommendationHandler struct {
	service *services.RecommendationService
}

func NewRecommendationHandler(service *services.RecommendationService) *RecommendationHandler {
	return &RecommendationHandler{service: service}
}

func (h *RecommendationHandler) Generate(c *gin.Context) {
	var req services.RecommendationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "service_ids is required",
			"code":  "missing_field",
			"field": "service_ids",
		})
		return
	}

	if len(req.ServiceIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least one service must be selected",
			"code":  "empty_selection",
		})
		return
	}

	if len(req.ServiceIDs) > services.MaxServicesPerRequest {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("Maximum %d services per request (you sent %d)", services.MaxServicesPerRequest, len(req.ServiceIDs)),
			"code":  "too_many_services",
		})
		return
	}

	result, err := h.service.Generate(req)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "no valid services") {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "None of the selected services were found. They may have been removed.",
				"code":  "services_not_found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Something went wrong generating your recommendations. Please try again.",
			"code":  "internal_error",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
