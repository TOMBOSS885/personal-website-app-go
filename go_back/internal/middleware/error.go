package middleware

import (
	"log"
	"net/http"
	"personal-website-go/internal/response"
	"runtime/debug"

	"github.com/gin-gonic/gin"
)

func ErrorHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("panic recovered requestId=%s error=%v\n%s", GetRequestID(c), err, debug.Stack())
				response.Error(c, http.StatusInternalServerError, "服务内部错误")
				c.Abort()
			}
		}()
		c.Next()
	}
}
