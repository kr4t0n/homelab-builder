package services

import (
	"encoding/json"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AnalyticsService struct {
	db *gorm.DB
}

func NewAnalyticsService(db *gorm.DB) *AnalyticsService {
	return &AnalyticsService{db: db}
}

func (s *AnalyticsService) Track(eventType string, userID *uuid.UUID, payload map[string]interface{}) {
	payloadJSON, _ := json.Marshal(payload)
	event := models.Event{
		UserID:    userID,
		EventType: eventType,
		Payload:   string(payloadJSON),
	}
	// Fire-and-forget: don't block the response on analytics
	go func() {
		_ = s.db.Create(&event).Error
	}()
}

// Common event types
const (
	EventServiceSelected    = "service_selected"
	EventRecommendationGen  = "recommendation_generated"
	EventShoppingListViewed = "shopping_list_viewed"
	EventChecklistStarted   = "checklist_started"
	EventServiceCreated     = "service_created"
	EventServiceDeleted     = "service_deleted"
)
