package middleware

import (
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateTokenUsesStrictAdminClaims(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: "test-secret-that-is-longer-than-thirty-two-bytes", JWTExpireMs: 60000}
	t.Cleanup(func() { config.AppConfig = previous })

	user := &model.User{ID: 42, Username: "admin", Password: "$2a$10$example", Role: "ADMIN"}
	raw, err := GenerateToken(user)
	if err != nil {
		t.Fatal(err)
	}
	claims := &adminClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(jwtIssuer), jwt.WithAudience(jwtAudience))
	if err != nil || !token.Valid {
		t.Fatalf("generated token is invalid: %v", err)
	}
	if claims.UserID != user.ID || claims.Subject != user.Username || claims.Role != "ADMIN" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
	if claims.ID == "" || claims.ExpiresAt == nil || time.Until(claims.ExpiresAt.Time) <= 0 {
		t.Fatal("registered claims are incomplete")
	}
	if claims.PasswordFingerprint != passwordFingerprint(user.Password) {
		t.Fatal("password fingerprint is missing")
	}
}
