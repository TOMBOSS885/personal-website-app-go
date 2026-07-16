package middleware

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

type requestLogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	RequestID string `json:"requestId"`
	Method    string `json:"method"`
	Path      string `json:"path"`
	Status    int    `json:"status"`
	LatencyMS int64  `json:"latencyMs"`
	Bytes     int    `json:"bytes"`
	IP        string `json:"ip"`
}

// RequestLogger deliberately excludes query strings and request bodies because
// they may contain signed media URLs, codes, or other credentials.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		started := time.Now()
		c.Next()

		entry := requestLogEntry{
			Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
			Level:     requestLogLevel(c.Writer.Status()),
			Message:   "http_request",
			RequestID: GetRequestID(c),
			Method:    c.Request.Method,
			Path:      c.Request.URL.Path,
			Status:    c.Writer.Status(),
			LatencyMS: time.Since(started).Milliseconds(),
			Bytes:     c.Writer.Size(),
			IP:        c.ClientIP(),
		}
		if encoded, err := json.Marshal(entry); err == nil {
			log.Print(string(encoded))
		}
	}
}

func requestLogLevel(status int) string {
	if status >= 500 {
		return "error"
	}
	if status >= 400 {
		return "warning"
	}
	return "info"
}
