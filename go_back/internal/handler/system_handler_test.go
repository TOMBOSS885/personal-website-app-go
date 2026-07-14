package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestMetaContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/meta", nil)

	Meta(context)

	var body struct {
		Service        string `json:"service"`
		APIVersion     int    `json:"apiVersion"`
		MinimumDesktop string `json:"minDesktopVersion"`
		ServerTime     string `json:"serverTime"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Service != APIServiceName || body.APIVersion != APIVersion || body.MinimumDesktop != MinimumDesktopVersion {
		t.Fatalf("unexpected metadata: %+v", body)
	}
	if _, err := time.Parse(time.RFC3339, body.ServerTime); err != nil {
		t.Fatalf("serverTime is not RFC3339: %q", body.ServerTime)
	}
}

func TestAdminSessionReturnsOnlySafeIdentityFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/admin/session", nil)
	context.Set("user", &model.User{
		ID: 7, Username: "admin", Password: "secret-hash", Email: "private@example.com",
		Role: "ADMIN", Nickname: "Owner", Avatar: "/uploads/avatar.png", TokenVersion: 99,
	})
	context.Set(middleware.AdminSessionContextKey, middleware.AdminSessionInfo{
		ID: "session-id", IssuedAt: "2026-07-14T10:00:00Z", ExpiresAt: "2026-07-15T10:00:00Z",
	})

	AdminSession(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", recorder.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	user, ok := body["user"].(map[string]any)
	if !ok {
		t.Fatalf("missing user object: %v", body)
	}
	for _, sensitive := range []string{"password", "email", "tokenVersion", "passwordConfigured"} {
		if _, exists := user[sensitive]; exists {
			t.Fatalf("sensitive field %q leaked in response: %v", sensitive, user)
		}
	}
	if user["username"] != "admin" || user["role"] != "ADMIN" {
		t.Fatalf("unexpected identity: %v", user)
	}
	if _, ok := body["session"].(map[string]any); !ok {
		t.Fatalf("missing session object: %v", body)
	}
}
