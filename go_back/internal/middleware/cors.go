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
			if strings.TrimSpace(config.AppConfig.CORSAllowedOrigins) == "*" {
				c.Header("Access-Control-Allow-Origin", "*")
			} else {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Vary", "Origin")
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")
			c.Header("Access-Control-Max-Age", "600")
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
	if strings.TrimSpace(allowed) == "" {
		return false
	}
	if allowed == "*" {
		return true
	}
	for _, item := range strings.Split(allowed, ",") {
		if strings.TrimSpace(item) == origin {
			return true
		}
	}
	return false
}
