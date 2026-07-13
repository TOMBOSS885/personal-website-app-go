package middleware

import (
	"context"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/model"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

var rateLimitScript = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`)

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
		settings := currentRateLimitSettings()
		if !settings.Enabled {
			c.Next()
			return
		}
		limit = limitForCategory(settings, name, limit)
		if limit <= 0 {
			c.Next()
			return
		}
		if window <= 0 {
			window = time.Minute
		}

		recordAccess(c.ClientIP(), name)
		ok, count, remaining := allowRequest(name, c.ClientIP(), limit, window)
		if !ok {
			recordLimit(c, name, count, limit, remaining)
			limitResponse(c, name, int64(remaining.Seconds()))
			return
		}
		c.Next()
	}
}

func allowRequest(name, ip string, limit int, window time.Duration) (bool, int64, time.Duration) {
	if cache.Ready() {
		if ok, err := allowRequestRedis(name, ip, limit, window); err == nil {
			return ok.allowed, ok.count, ok.remaining
		}
	}
	return allowRequestLocal(name, ip, limit, window)
}

type rateDecision struct {
	allowed   bool
	count     int64
	remaining time.Duration
}

func allowRequestRedis(name, ip string, limit int, window time.Duration) (rateDecision, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
	defer cancel()

	key := "rl:" + name + ":" + ip
	result, err := rateLimitScript.Run(ctx, cache.Client, []string{key}, window.Milliseconds()).Int64Slice()
	if err != nil {
		cache.MarkFailure(err)
		return rateDecision{allowed: true, count: 1, remaining: window}, err
	}
	cache.MarkSuccess()
	if len(result) != 2 {
		return rateDecision{}, redis.ErrClosed
	}
	count := result[0]
	ttl := time.Duration(result[1]) * time.Millisecond
	if ttl <= 0 {
		ttl = window
	}
	return rateDecision{allowed: count <= int64(limit), count: count, remaining: ttl}, nil
}

func allowRequestLocal(name, ip string, limit int, window time.Duration) (bool, int64, time.Duration) {
	key := "rl:" + name + ":" + ip
	now := time.Now()

	localRateStore.Lock()
	defer localRateStore.Unlock()

	entry, exists := localRateStore.entries[key]
	if !exists || now.After(entry.ResetAt) {
		localRateStore.entries[key] = localRateEntry{Count: 1, ResetAt: now.Add(window)}
		return true, 1, window
	}

	entry.Count++
	localRateStore.entries[key] = entry
	return entry.Count <= limit, int64(entry.Count), time.Until(entry.ResetAt)
}

func CleanupExpiredLocalRateLimits(now time.Time) int {
	if now.IsZero() {
		now = time.Now()
	}

	localRateStore.Lock()
	defer localRateStore.Unlock()

	removed := 0
	for key, entry := range localRateStore.entries {
		if entry.ResetAt.IsZero() || now.Before(entry.ResetAt) {
			continue
		}
		delete(localRateStore.entries, key)
		removed++
	}
	return removed
}

func limitForCategory(settings model.RateLimitSettings, name string, fallback int) int {
	switch name {
	case securityCategoryPublic:
		return settings.PublicPerMinute
	case securityCategoryMusic:
		return settings.MusicPerMinute
	case securityCategoryMusicStream:
		return settings.MusicStreamPerMinute
	case securityCategoryArticleUnlock:
		return settings.ArticleUnlockPerMinute
	default:
		return fallback
	}
}
