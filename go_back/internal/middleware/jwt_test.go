package middleware

import (
	"net/http"
	"net/http/httptest"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
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

func TestAdminSessionInfoUsesRegisteredClaims(t *testing.T) {
	issuedAt := time.Date(2026, time.July, 14, 10, 0, 0, 0, time.FixedZone("CST", 8*60*60))
	expiresAt := issuedAt.Add(24 * time.Hour)
	claims := &adminClaims{RegisteredClaims: jwt.RegisteredClaims{
		ID:        "session-id",
		IssuedAt:  jwt.NewNumericDate(issuedAt),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
	}}

	session := adminSessionInfo(claims)
	if session.ID != "session-id" {
		t.Fatalf("session ID = %q", session.ID)
	}
	if session.IssuedAt != issuedAt.UTC().Format(time.RFC3339) {
		t.Fatalf("issuedAt = %q", session.IssuedAt)
	}
	if session.ExpiresAt != expiresAt.UTC().Format(time.RFC3339) {
		t.Fatalf("expiresAt = %q", session.ExpiresAt)
	}
}

func TestSameOriginMutationRejectsCookieRequestWithoutOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := httptest.NewRequest(http.MethodPost, "https://example.com/api/account/logout", nil)
	request.Host = "example.com"
	request.AddCookie(&http.Cookie{Name: UserSessionCookie, Value: "session"})
	context.Request = request

	if isSameOriginMutation(context) {
		t.Fatal("cookie mutation without Origin, Referer, or Sec-Fetch-Site must be rejected")
	}
	request.Header.Set("Origin", "https://example.com")
	if !isSameOriginMutation(context) {
		t.Fatal("same-origin cookie mutation should be accepted")
	}
	request.Header.Set("Origin", "https://evil.example")
	if isSameOriginMutation(context) {
		t.Fatal("cross-origin cookie mutation must be rejected")
	}
}

func TestSameOriginMutationAllowsBearerClientWithoutBrowserHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := httptest.NewRequest(http.MethodPut, "https://example.com/api/account/username", nil)
	request.Host = "example.com"
	request.Header.Set("Authorization", "Bearer token")
	context.Request = request

	if !isSameOriginMutation(context) {
		t.Fatal("non-browser bearer client should be accepted without browser origin headers")
	}
}
