package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequestIDPreservesValidHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const incoming = "desktop-01JABCDEF0123456789"
	router := gin.New()
	router.Use(RequestID())
	router.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"requestId": GetRequestID(c)})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, incoming)
	router.ServeHTTP(recorder, request)

	if got := recorder.Header().Get(RequestIDHeader); got != incoming {
		t.Fatalf("response request ID = %q, want %q", got, incoming)
	}
	if got := recorder.Body.String(); got != `{"requestId":"`+incoming+`"}` {
		t.Fatalf("unexpected response body: %s", got)
	}
}

func TestRequestIDReplacesInvalidHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(RequestID())
	router.GET("/", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(RequestIDHeader, "contains spaces and is invalid")
	router.ServeHTTP(recorder, request)

	generated := recorder.Header().Get(RequestIDHeader)
	if !requestIDPattern.MatchString(generated) {
		t.Fatalf("generated request ID is invalid: %q", generated)
	}
	if generated == request.Header.Get(RequestIDHeader) {
		t.Fatal("invalid caller request ID was preserved")
	}
}
