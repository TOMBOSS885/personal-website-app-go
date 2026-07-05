package middleware

import (
	"bytes"
	"context"
	"net/http"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type cachedResponseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w cachedResponseWriter) Write(data []byte) (int, error) {
	w.body.Write(data)
	return w.ResponseWriter.Write(data)
}

func CacheGET(prefix string) gin.HandlerFunc {
	return func(c *gin.Context) {
		setPublicHTTPCacheHeaders(c)
		if !shouldCacheRequest(c) {
			c.Next()
			return
		}

		key := cacheKey(prefix, c.Request.URL.RequestURI())
		ctx, cancel := context.WithTimeout(c.Request.Context(), 500*time.Millisecond)
		defer cancel()

		if cached, err := cache.Client.Get(ctx, key).Bytes(); err == nil {
			c.Header("X-Cache", "HIT")
			c.Data(http.StatusOK, "application/json; charset=utf-8", cached)
			c.Abort()
			return
		}

		c.Header("X-Cache", "MISS")
		buffer := &bytes.Buffer{}
		writer := cachedResponseWriter{ResponseWriter: c.Writer, body: buffer}
		c.Writer = writer
		c.Next()

		if c.Writer.Status() != http.StatusOK || buffer.Len() == 0 {
			return
		}

		ttl := time.Duration(config.AppConfig.CacheTTLSeconds) * time.Second
		if ttl <= 0 {
			ttl = 60 * time.Second
		}

		setCtx, setCancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer setCancel()
		_ = cache.Client.Set(setCtx, key, buffer.Bytes(), ttl).Err()
	}
}

func setPublicHTTPCacheHeaders(c *gin.Context) {
	ttl := 30
	if config.AppConfig != nil && config.AppConfig.CacheTTLSeconds > 0 {
		ttl = config.AppConfig.CacheTTLSeconds
	}
	if ttl > 60 {
		ttl = 60
	}
	c.Header("Cache-Control", "public, max-age="+strconv.Itoa(ttl)+", stale-while-revalidate=300")
}

func InvalidatePublicCacheAfterMutation() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() >= http.StatusBadRequest || !isMutation(c.Request.Method) {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		cache.DeleteByPrefix(ctx, "cache:public:")
	}
}

func shouldCacheRequest(c *gin.Context) bool {
	return config.AppConfig != nil &&
		config.AppConfig.RedisEnabled &&
		config.AppConfig.CacheEnabled &&
		cache.Ready() &&
		c.Request.Method == http.MethodGet
}

func cacheKey(prefix, uri string) string {
	return "cache:" + strings.Trim(prefix, ":") + ":" + uri
}

func isMutation(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}
