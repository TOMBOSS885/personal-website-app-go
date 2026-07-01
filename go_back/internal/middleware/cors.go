package middleware

import (
	"net/http"
	"personal-website-go/internal/config"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin != "" && isAllowedOrigin(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func isAllowedOrigin(origin string) bool {
	allowed := config.AppConfig.CORSAllowedOrigins
	if allowed == "" || allowed == "*" {
		return true
	}
	for _, item := range strings.Split(allowed, ",") {
		if strings.TrimSpace(item) == origin {
			return true
		}
	}
	return false
}
