package middleware

import (
	"net/http"
	"net/http/httptest"
	"personal-website-go/internal/config"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCORSAllowsAndExposesRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previous := config.AppConfig
	config.AppConfig = &config.Config{CORSAllowedOrigins: "https://desktop.example"}
	t.Cleanup(func() { config.AppConfig = previous })

	router := gin.New()
	router.Use(RequestID(), CORS())
	router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set("Origin", "https://desktop.example")
	router.ServeHTTP(recorder, request)

	if !strings.Contains(recorder.Header().Get("Access-Control-Allow-Headers"), RequestIDHeader) {
		t.Fatal("CORS does not allow the request ID header")
	}
	if recorder.Header().Get("Access-Control-Expose-Headers") != RequestIDHeader {
		t.Fatal("CORS does not expose the request ID header")
	}
}
