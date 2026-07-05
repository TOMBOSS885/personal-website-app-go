package middleware

import (
	"context"
	"net/http"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/response"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type localRateEntry struct {
	Count   int
	ResetAt time.Time
}

var localRateStore = struct {
	sync.Mutex
	entries map[string]localRateEntry
}{
	entries: map[string]localRateEntry{},
}

func RateLimit(name string, limit int, window time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if config.AppConfig == nil || !config.AppConfig.RateLimitEnabled || limit <= 0 {
			c.Next()
			return
		}
		if window <= 0 {
			window = time.Minute
		}

		ok := allowRequest(name, c.ClientIP(), limit, window)
		if !ok {
			response.Error(c, http.StatusTooManyRequests, "too many requests, please try again later")
			c.Abort()
			return
		}
		c.Next()
	}
}

func allowRequest(name, ip string, limit int, window time.Duration) bool {
	if cache.Ready() {
		if ok, err := allowRequestRedis(name, ip, limit, window); err == nil {
			return ok
		}
	}
	return allowRequestLocal(name, ip, limit, window)
}

func allowRequestRedis(name, ip string, limit int, window time.Duration) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()

	key := "rl:" + name + ":" + ip
	count, err := cache.Client.Incr(ctx, key).Result()
	if err != nil {
		return true, err
	}
	if count == 1 {
		_ = cache.Client.Expire(ctx, key, window).Err()
	}
	return count <= int64(limit), nil
}

func allowRequestLocal(name, ip string, limit int, window time.Duration) bool {
	key := "rl:" + name + ":" + ip
	now := time.Now()

	localRateStore.Lock()
	defer localRateStore.Unlock()

	entry, exists := localRateStore.entries[key]
	if !exists || now.After(entry.ResetAt) {
		localRateStore.entries[key] = localRateEntry{Count: 1, ResetAt: now.Add(window)}
		return true
	}

	entry.Count++
	localRateStore.entries[key] = entry
	return entry.Count <= limit
}
