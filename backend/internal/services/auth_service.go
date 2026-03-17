package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthService(db *gorm.DB) *AuthService {
	rawSecret := os.Getenv("JWT_SECRET")
	defaultSecret := "orbit-dev-secret-change-in-production"

	secret := rawSecret
	if secret == "" {
		secret = defaultSecret
	}

	// SECURITY FIX: Refuse to start in production with a weak or default JWT secret
	if gin.Mode() == gin.ReleaseMode {
		if rawSecret == "" || rawSecret == defaultSecret || rawSecret == "change-this-in-production" {
			panic("CRITICAL SECURITY ERROR: JWT_SECRET MUST be set to a strong, unique value in production (GIN_MODE=release). Refusing to start.")
		}
	}

	return &AuthService{
		db:        db,
		jwtSecret: []byte(secret),
	}
}

type TokenClaims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	jwt.RegisteredClaims
}

type RegisterInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (s *AuthService) Register(input RegisterInput) (*AuthResponse, error) {
	// Check if email already exists
	var existing models.User
	if err := s.db.Where("email = ?", input.Email).First(&existing).Error; err == nil {
		return nil, errors.New("email already registered")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := models.User{
		Email:        input.Email,
		PasswordHash: string(hash),
		Name:         input.Name,
	}
	if err := s.db.Create(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

func (s *AuthService) Login(input LoginInput) (*AuthResponse, error) {
	var user models.User
	if err := s.db.Where("email = ?", input.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid credentials")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{Token: token, User: user}, nil
}

func (s *AuthService) GetCurrentUser(userID uuid.UUID) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) UpdatePreferences(userID uuid.UUID, prefs map[string]interface{}) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}

	// Unmarshal existing preferences to merge
	var existingPrefs map[string]interface{}
	if len(user.Preferences) > 0 {
		if err := json.Unmarshal(user.Preferences, &existingPrefs); err != nil {
			existingPrefs = make(map[string]interface{})
		}
	} else {
		existingPrefs = make(map[string]interface{})
	}

	// Merge incoming prefs
	for k, v := range prefs {
		existingPrefs[k] = v
	}

	rawPrefs, err := json.Marshal(existingPrefs)
	if err != nil {
		return nil, fmt.Errorf("invalid preferences payload: %w", err)
	}

	user.Preferences = rawPrefs
	if err := s.db.Save(&user).Error; err != nil {
		return nil, fmt.Errorf("failed to save preferences: %w", err)
	}

	return &user, nil
}

func (s *AuthService) generateToken(user models.User) (string, error) {
	claims := TokenClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "orbit",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) ValidateToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &TokenClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*TokenClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}
