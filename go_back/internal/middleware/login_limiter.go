package middleware

import (
	"context"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"strings"
	"sync"
	"time"
)

const (
	loginLimitWindow   = 10 * time.Minute
	loginLimitMaxFails = 5
)

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
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		count, err := cache.Client.Get(ctx, redisLoginAttemptKey(ip, username)).Int()
		if err == nil {
			return count < loginLimitMaxFailures()
		}
	}

	key := loginAttemptKey(ip, username)
	now := time.Now()

	loginAttempts.Lock()
	defer loginAttempts.Unlock()

	entry, exists := loginAttempts.entries[key]
	if !exists || now.After(entry.ResetAt) {
		delete(loginAttempts.entries, key)
		return true
	}
	return entry.Failures < loginLimitMaxFailures()
}

func RecordLoginFailure(ip, username string) {
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		key := redisLoginAttemptKey(ip, username)
		count, err := cache.Client.Incr(ctx, key).Result()
		if err == nil && count == 1 {
			_ = cache.Client.Expire(ctx, key, loginLimitDuration()).Err()
		}
		if err == nil {
			return
		}
	}

	key := loginAttemptKey(ip, username)
	now := time.Now()

	loginAttempts.Lock()
	defer loginAttempts.Unlock()

	entry, exists := loginAttempts.entries[key]
	if !exists || now.After(entry.ResetAt) {
		entry = loginAttempt{ResetAt: now.Add(loginLimitDuration())}
	}
	entry.Failures++
	loginAttempts.entries[key] = entry
}

func RecordLoginSuccess(ip, username string) {
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
		defer cancel()
		_ = cache.Client.Del(ctx, redisLoginAttemptKey(ip, username)).Err()
	}

	key := loginAttemptKey(ip, username)
	loginAttempts.Lock()
	defer loginAttempts.Unlock()
	delete(loginAttempts.entries, key)
}

func loginAttemptKey(ip, username string) string {
	return strings.TrimSpace(ip) + "|" + strings.ToLower(strings.TrimSpace(username))
}

func redisLoginAttemptKey(ip, username string) string {
	return "login:fail:" + loginAttemptKey(ip, username)
}

func loginLimitMaxFailures() int {
	if config.AppConfig != nil && config.AppConfig.LoginLimitMaxFails > 0 {
		return config.AppConfig.LoginLimitMaxFails
	}
	return loginLimitMaxFails
}

func loginLimitDuration() time.Duration {
	if config.AppConfig != nil && config.AppConfig.LoginLimitWindow > 0 {
		return time.Duration(config.AppConfig.LoginLimitWindow) * time.Second
	}
	return loginLimitWindow
}
