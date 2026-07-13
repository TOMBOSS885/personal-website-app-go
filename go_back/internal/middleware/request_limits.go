package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	maxRequestBodyBytes = int64(300 << 20)
	maxJSONBodyBytes    = int64(2 << 20)
)

func RequestBodyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := maxRequestBodyBytes
		contentType := strings.ToLower(c.GetHeader("Content-Type"))
		if strings.HasPrefix(contentType, "application/json") {
			limit = maxJSONBodyBytes
		}
		if c.Request.ContentLength > limit {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"message": "请求内容过大"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}
