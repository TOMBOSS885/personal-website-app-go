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

func TestGenerateUserAccessTokenUsesDesktopBearerClaims(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: "test-secret-that-is-longer-than-thirty-two-bytes", JWTExpireMs: 90000}
	t.Cleanup(func() { config.AppConfig = previous })

	user := &model.User{ID: 84, Email: "Reader@Example.com", Role: "USER", Status: "active", TokenVersion: 7}
	session, err := GenerateUserAccessToken(user)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := parseUserToken(session.Token)
	if err != nil {
		t.Fatalf("generated user access token is invalid: %v", err)
	}
	if claims.UserID != user.ID || claims.Subject != "reader@example.com" || claims.Role != "USER" || claims.TokenVersion != 7 {
		t.Fatalf("unexpected user claims: %+v", claims)
	}
	if claims.Issuer != userJWTIssuer || len(claims.Audience) != 1 || claims.Audience[0] != userJWTAudience || claims.ID == "" {
		t.Fatalf("registered user claims are incomplete: %+v", claims.RegisteredClaims)
	}
	if session.ExpiresAt.Sub(session.IssuedAt) != 90*time.Second {
		t.Fatalf("token lifetime = %v", session.ExpiresAt.Sub(session.IssuedAt))
	}
}

func TestParseUserTokenRejectsExpiredToken(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{JWTSecret: "test-secret-that-is-longer-than-thirty-two-bytes", JWTExpireMs: 60000}
	t.Cleanup(func() { config.AppConfig = previous })

	now := time.Now().UTC()
	claims := userClaims{
		UserID: 1, Role: "USER", TokenVersion: 1,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer: userJWTIssuer, Audience: jwt.ClaimStrings{userJWTAudience}, Subject: "reader@example.com", ID: "expired",
			IssuedAt: jwt.NewNumericDate(now.Add(-2 * time.Minute)), ExpiresAt: jwt.NewNumericDate(now.Add(-time.Minute)),
		},
	}
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseUserToken(raw); err == nil {
		t.Fatalf("expired token should be rejected, got %v", err)
	}
}

func TestUserTokenVersionRevokesAllEarlierSessions(t *testing.T) {
	if !userTokenVersionMatches(4, 4) {
		t.Fatal("current token version should remain valid")
	}
	if userTokenVersionMatches(5, 4) {
		t.Fatal("incrementing the stored token version must revoke an earlier token")
	}
	if !userTokenVersionMatches(0, 1) {
		t.Fatal("legacy zero database versions should normalize to version one")
	}
	if userTokenVersionMatches(1, 0) {
		t.Fatal("tokens without an explicit token version must be rejected")
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

func TestSameOriginMutationAllowsBearerEvenWithStaleCookieAndDesktopOrigin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	request := httptest.NewRequest(http.MethodDelete, "https://example.com/api/user/comments/1", nil)
	request.Host = "example.com"
	request.Header.Set("Authorization", "bearer desktop-token")
	request.Header.Set("Origin", "http://tauri.localhost")
	request.AddCookie(&http.Cookie{Name: UserSessionCookie, Value: "stale-cookie"})
	context.Request = request

	if !isSameOriginMutation(context) {
		t.Fatal("explicit bearer credentials should not be subjected to cookie CSRF origin checks")
	}
}

func TestBearerTokenRequiresExactlyOneCredential(t *testing.T) {
	if token, ok := bearerToken("Bearer abc.def"); !ok || token != "abc.def" {
		t.Fatalf("valid bearer header was not parsed: %q, %v", token, ok)
	}
	if token, ok := bearerToken("bearer abc.def"); !ok || token != "abc.def" {
		t.Fatalf("auth scheme should be case-insensitive: %q, %v", token, ok)
	}
	for _, value := range []string{"", "Bearer", "Basic abc", "Bearer one two"} {
		if _, ok := bearerToken(value); ok {
			t.Fatalf("malformed bearer header %q should fail", value)
		}
	}
}
