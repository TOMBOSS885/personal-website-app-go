package middleware

import (
	"context"
	"personal-website-go/internal/cache"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	loginLimitWindow      = 10 * time.Minute
	loginLimitMaxFails    = 5
	maxLocalLoginAttempts = 20000
)

var loginFailureScript = redis.NewScript(`
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then
    redis.call('PEXPIRE', key, ARGV[1])
  end
end
return 1
`)

type loginAttempt struct {
	Failures int
	ResetAt  time.Time
}

var loginAttempts = struct {
	sync.Mutex
	entries map[string]loginAttempt
}{
	entries: map[string]loginAttempt{},
}

func AllowLoginAttempt(ip, username string) bool {
	if !currentRateLimitSettings().Enabled {
		return true
	}
	keys := loginAttemptKeys(ip, username)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		values, err := cache.Client.MGet(ctx, redisLoginAttemptKey(keys[0]), redisLoginAttemptKey(keys[1]), redisLoginAttemptKey(keys[2])).Result()
		cancel()
		if err == nil {
			cache.MarkSuccess()
			for index, value := range values {
				count, _ := strconv.Atoi(toString(value))
				if count >= loginLimitForKey(index) {
					return false
				}
			}
			return true
		}
		cache.MarkFailure(err)
	}

	now := time.Now()
	loginAttempts.Lock()
	defer loginAttempts.Unlock()
	for index, key := range keys {
		entry, exists := loginAttempts.entries[key]
		if !exists || now.After(entry.ResetAt) {
			delete(loginAttempts.entries, key)
			continue
		}
		if entry.Failures >= loginLimitForKey(index) {
			return false
		}
	}
	return true
}

func RecordLoginFailure(ip, username string) {
	keys := loginAttemptKeys(ip, username)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		err := loginFailureScript.Run(ctx, cache.Client,
			[]string{redisLoginAttemptKey(keys[0]), redisLoginAttemptKey(keys[1]), redisLoginAttemptKey(keys[2])}, loginLimitDuration().Milliseconds()).Err()
		cancel()
		if err == nil {
			cache.MarkSuccess()
			return
		}
		cache.MarkFailure(err)
	}

	now := time.Now()
	loginAttempts.Lock()
	defer loginAttempts.Unlock()
	if len(loginAttempts.entries) >= maxLocalLoginAttempts {
		cleanupExpiredLoginAttemptsLocked(now)
	}
	for _, key := range keys {
		entry, exists := loginAttempts.entries[key]
		if !exists || now.After(entry.ResetAt) {
			entry = loginAttempt{ResetAt: now.Add(loginLimitDuration())}
		}
		entry.Failures++
		loginAttempts.entries[key] = entry
	}
}

func RecordLoginSuccess(ip, username string) {
	keys := loginAttemptKeys(ip, username)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 250*time.Millisecond)
		err := cache.Client.Del(ctx, redisLoginAttemptKey(keys[0]), redisLoginAttemptKey(keys[1]), redisLoginAttemptKey(keys[2])).Err()
		cancel()
		if err == nil {
			cache.MarkSuccess()
		} else {
			cache.MarkFailure(err)
		}
	}

	loginAttempts.Lock()
	defer loginAttempts.Unlock()
	for _, key := range keys {
		delete(loginAttempts.entries, key)
	}
}

func loginAttemptKeys(ip, username string) [3]string {
	cleanIP := strings.TrimSpace(ip)
	cleanUsername := strings.ToLower(strings.TrimSpace(username))
	return [3]string{
		"ip|" + cleanIP,
		"pair|" + cleanIP + "|" + cleanUsername,
		"account|" + cleanUsername,
	}
}

func loginLimitForKey(index int) int {
	limit := loginLimitMaxFailures()
	if index == 2 {
		return limit * 5
	}
	return limit
}

func redisLoginAttemptKey(key string) string {
	return "login:fail:" + key
}

func cleanupExpiredLoginAttemptsLocked(now time.Time) {
	for key, entry := range loginAttempts.entries {
		if !entry.ResetAt.IsZero() && !now.Before(entry.ResetAt) {
			delete(loginAttempts.entries, key)
		}
	}
}

func toString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	default:
		return ""
	}
}

func loginLimitMaxFailures() int {
	settings := currentRateLimitSettings()
	if settings.LoginMaxFailures > 0 {
		return settings.LoginMaxFailures
	}
	return loginLimitMaxFails
}

func loginLimitDuration() time.Duration {
	settings := currentRateLimitSettings()
	if settings.LoginWindowSeconds > 0 {
		return time.Duration(settings.LoginWindowSeconds) * time.Second
	}
	return loginLimitWindow
}
