package services

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthService_Register(t *testing.T) {
	tx := testTx(t)
	os.Setenv("JWT_SECRET", "test-secret-key-12345")
	authSvc := NewAuthService(tx)

	input := RegisterInput{
		Email:    "newuser@example.com",
		Password: "securepassword",
		Name:     "New User",
	}

	result, err := authSvc.Register(input)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	if result.Token == "" {
		t.Error("Expected non-empty token")
	}
	if result.User.Email != input.Email {
		t.Errorf("Expected email %s, got %s", input.Email, result.User.Email)
	}
	if result.User.Name != input.Name {
		t.Errorf("Expected name %s, got %s", input.Name, result.User.Name)
	}

	// Verify password was hashed
	var dbUser models.User
	tx.Where("email = ?", input.Email).First(&dbUser)
	if err := bcrypt.CompareHashAndPassword([]byte(dbUser.PasswordHash), []byte(input.Password)); err != nil {
		t.Error("Password hash does not match original password")
	}

	// Duplicate email should fail
	_, err = authSvc.Register(input)
	if err == nil {
		t.Error("Expected error for duplicate email registration")
	}
}

func TestAuthService_Login(t *testing.T) {
	tx := testTx(t)
	os.Setenv("JWT_SECRET", "test-secret-key-12345")
	authSvc := NewAuthService(tx)

	// Register first
	regInput := RegisterInput{
		Email:    "logintest@example.com",
		Password: "mypassword123",
		Name:     "Login Test",
	}
	_, err := authSvc.Register(regInput)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}

	// Login with correct credentials
	loginInput := LoginInput{Email: regInput.Email, Password: regInput.Password}
	result, err := authSvc.Login(loginInput)
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if result.Token == "" {
		t.Error("Expected non-empty token")
	}
	if result.User.Email != regInput.Email {
		t.Errorf("Expected email %s, got %s", regInput.Email, result.User.Email)
	}

	// Login with wrong password
	badInput := LoginInput{Email: regInput.Email, Password: "wrongpassword"}
	_, err = authSvc.Login(badInput)
	if err == nil {
		t.Error("Expected error for wrong password")
	}

	// Login with non-existent email
	noUserInput := LoginInput{Email: "noone@example.com", Password: "whatever"}
	_, err = authSvc.Login(noUserInput)
	if err == nil {
		t.Error("Expected error for non-existent email")
	}
}

func TestAuthService_UpdatePreferences(t *testing.T) {
	tx := testTx(t)
	os.Setenv("JWT_SECRET", "test-secret-key-12345")
	authSvc := NewAuthService(tx)

	// Register a user
	regInput := RegisterInput{
		Email:    "prefs@example.com",
		Password: "securepassword",
		Name:     "Prefs User",
	}
	regResult, err := authSvc.Register(regInput)
	if err != nil {
		t.Fatalf("Register failed: %v", err)
	}
	userID := regResult.User.ID

	// Initial Preferences should be empty JSON "{}"
	loadedUser, err := authSvc.GetCurrentUser(userID)
	if err != nil {
		t.Fatalf("Failed to fetch user: %v", err)
	}

	if string(loadedUser.Preferences) != "{}" && string(loadedUser.Preferences) != "" && string(loadedUser.Preferences) != "null" {
		t.Errorf("Expected initial preferences to be empty, got: %v", string(loadedUser.Preferences))
	}

	// Perform Update
	newPrefs := map[string]interface{}{
		"theme":     "dark",
		"showHints": false,
		"timezone":  "UTC",
	}

	updatedUser, err := authSvc.UpdatePreferences(userID, newPrefs)
	if err != nil {
		t.Fatalf("UpdatePreferences failed: %v", err)
	}

	var unmarshaledPrefs map[string]interface{}
	if err := json.Unmarshal(updatedUser.Preferences, &unmarshaledPrefs); err != nil {
		t.Fatalf("Failed to unmarshal returned preferences: %v", err)
	}

	if unmarshaledPrefs["theme"] != "dark" {
		t.Errorf("Expected theme 'dark', got %v", unmarshaledPrefs["theme"])
	}
	if hints, ok := unmarshaledPrefs["showHints"].(bool); !ok || hints != false {
		t.Errorf("Expected showHints to be false, got %v", unmarshaledPrefs["showHints"])
	}

	// Verify persistence in DB
	persistedUser, _ := authSvc.GetCurrentUser(userID)
	var persistedPrefs map[string]interface{}
	json.Unmarshal(persistedUser.Preferences, &persistedPrefs)

	if !reflect.DeepEqual(unmarshaledPrefs, persistedPrefs) {
		t.Errorf("Persisted preferences do not match updated preferences. \nGot: %v \nWant: %v", persistedPrefs, unmarshaledPrefs)
	}
}

func TestAuthService_ValidateToken(t *testing.T) {
	tx := testTx(t)
	os.Setenv("JWT_SECRET", "test-secret-key-12345")
	authSvc := NewAuthService(tx)

	user := models.User{
		ID:           uuid.New(),
		Email:        "tokenuser@test.com",
		PasswordHash: "not-a-real-hash",
	}

	token, err := authSvc.generateToken(user)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	claims, err := authSvc.ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken failed on valid token: %v", err)
	}

	if claims.UserID != user.ID {
		t.Errorf("Claim UserID mismatch. Want %s, got %s", user.ID, claims.UserID)
	}
	if claims.Email != user.Email {
		t.Errorf("Claim Email mismatch. Want %s, got %s", user.Email, claims.Email)
	}

	// Test Invalid Secret
	os.Setenv("JWT_SECRET", "wrong-secret-key")
	invalidAuthSvc := NewAuthService(tx)
	_, err = invalidAuthSvc.ValidateToken(token)
	if err == nil {
		t.Error("ValidateToken should fail with incorrect secret")
	}

	// Test Expired Token
	expiredClaims := TokenClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			Issuer:    "orbit",
		},
	}
	expiredToken, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims).SignedString([]byte("test-secret-key-12345"))

	os.Setenv("JWT_SECRET", "test-secret-key-12345")
	validAuthSvc := NewAuthService(tx)

	_, err = validAuthSvc.ValidateToken(expiredToken)
	if err == nil {
		t.Error("ValidateToken should fail on expired token")
	}
}
