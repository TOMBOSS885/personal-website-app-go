package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

const (
	securityCategoryPublic        = "public"
	securityCategoryMusic         = "music"
	securityCategoryMusicStream   = "music-stream"
	securityCategoryLogin         = "login"
	securityCategoryArticleUnlock = "article-unlock"
)

var settingsCache = struct {
	sync.Mutex
	value     *model.RateLimitSettings
	expiresAt time.Time
}{}

var negativeBanCache = struct {
	sync.Mutex
	entries map[string]time.Time
}{entries: make(map[string]time.Time)}

func currentRateLimitSettings() model.RateLimitSettings {
	now := time.Now()
	settingsCache.Lock()
	if settingsCache.value != nil && now.Before(settingsCache.expiresAt) {
		value := *settingsCache.value
		settingsCache.Unlock()
		return value
	}
	settingsCache.Unlock()

	if db.DB == nil {
		return defaultRateLimitSettings()
	}

	settings, err := repository.GetOrCreateRateLimitSettings()
	if err != nil || settings == nil {
		return defaultRateLimitSettings()
	}

	settingsCache.Lock()
	settingsCache.value = settings
	settingsCache.expiresAt = now.Add(5 * time.Second)
	value := *settings
	settingsCache.Unlock()
	return value
}

func defaultRateLimitSettings() model.RateLimitSettings {
	settings := model.RateLimitSettings{
		Enabled:                     true,
		PublicPerMinute:             180,
		MusicPerMinute:              90,
		MusicStreamPerMinute:        240,
		ArticleUnlockPerMinute:      30,
		ArticleUnlockMaxFailures:    5,
		ArticleUnlockPenaltySeconds: 600,
		LoginMaxFailures:            5,
		LoginWindowSeconds:          600,
		DailyLimitTriggerThreshold:  5,
		BanDays:                     30,
	}
	if config.AppConfig != nil {
		settings.Enabled = config.AppConfig.RateLimitEnabled
		settings.PublicPerMinute = config.AppConfig.PublicRateLimit
		settings.MusicPerMinute = config.AppConfig.MusicRateLimit
		settings.MusicStreamPerMinute = config.AppConfig.MusicStreamRateLimit
		settings.LoginMaxFailures = config.AppConfig.LoginLimitMaxFails
		settings.LoginWindowSeconds = config.AppConfig.LoginLimitWindow
	}
	return settings
}

func ClearRateLimitSettingsCache() {
	settingsCache.Lock()
	settingsCache.value = nil
	settingsCache.expiresAt = time.Time{}
	settingsCache.Unlock()
}

func IPBanGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		if banned, remaining := isIPBanned(ip); banned {
			repository.RecordSecurityAccess(model.SecurityAccessStat{
				Date:         time.Now().Format("20060102"),
				IP:           ip,
				Category:     "ban",
				BlockedCount: 1,
			})
			c.JSON(http.StatusForbidden, gin.H{
				"code":             "ip_banned",
				"message":          "访问已被临时封禁，请稍后再试",
				"remainingSeconds": int64(remaining.Seconds()),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func isIPBanned(ip string) (bool, time.Duration) {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return false, 0
	}
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		ttl, err := cache.Client.TTL(ctx, banKey(ip)).Result()
		cancel()
		if err == nil && ttl > 0 {
			cache.MarkSuccess()
			forgetNegativeBan(ip)
			return true, ttl
		}
		if err != nil && err != redis.Nil {
			cache.MarkFailure(err)
		}
	}
	if isKnownNotBanned(ip, time.Now()) {
		return false, 0
	}
	event, err := repository.FindActiveBan(ip)
	if err == nil && event != nil && event.ExpiresAt != nil {
		remaining := time.Until(*event.ExpiresAt)
		if remaining > 0 {
			forgetNegativeBan(ip)
			if cache.Ready() {
				ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
				defer cancel()
				_ = cache.Client.Set(ctx, banKey(ip), "1", remaining).Err()
			}
			return true, remaining
		}
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		rememberNegativeBan(ip, time.Now().Add(30*time.Second))
	}
	return false, 0
}

func isKnownNotBanned(ip string, now time.Time) bool {
	negativeBanCache.Lock()
	defer negativeBanCache.Unlock()
	expiresAt, ok := negativeBanCache.entries[ip]
	if !ok {
		return false
	}
	if !now.Before(expiresAt) {
		delete(negativeBanCache.entries, ip)
		return false
	}
	return true
}

func rememberNegativeBan(ip string, expiresAt time.Time) {
	negativeBanCache.Lock()
	defer negativeBanCache.Unlock()
	if len(negativeBanCache.entries) >= 20000 {
		now := time.Now()
		for key, expiry := range negativeBanCache.entries {
			if !now.Before(expiry) {
				delete(negativeBanCache.entries, key)
			}
		}
	}
	if len(negativeBanCache.entries) < 20000 {
		negativeBanCache.entries[ip] = expiresAt
	}
}

func forgetNegativeBan(ip string) {
	negativeBanCache.Lock()
	delete(negativeBanCache.entries, ip)
	negativeBanCache.Unlock()
}

func recordAccess(ip, category string) {
	repository.RecordSecurityAccess(model.SecurityAccessStat{
		Date:     time.Now().Format("20060102"),
		IP:       ip,
		Category: category,
		Count:    1,
	})
}

func recordLimit(c *gin.Context, category string, count int64, limit int, window time.Duration) {
	ip := c.ClientIP()
	remaining := int64(window.Seconds())
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		defer cancel()
		key := limitKey(category, ip)
		_ = cache.Client.Set(ctx, key, fmt.Sprintf("%d/%d", count, limit), window).Err()
		if ttl, err := cache.Client.TTL(ctx, key).Result(); err == nil && ttl > 0 {
			remaining = int64(ttl.Seconds())
		}
	}

	repository.RecordSecurityAccess(model.SecurityAccessStat{
		Date:         time.Now().Format("20060102"),
		IP:           ip,
		Category:     category,
		LimitedCount: 1,
	})
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:             "limit",
		Severity:         severityForCategory(category),
		IP:               ip,
		Category:         category,
		Path:             c.Request.URL.RequestURI(),
		Method:           c.Request.Method,
		UserAgent:        c.Request.UserAgent(),
		Message:          limitMessage(category),
		Count:            count,
		Limit:            limit,
		RemainingSeconds: remaining,
	})
	recordLimitTrigger(c, category)
}

func recordLimitTrigger(c *gin.Context, category string) {
	settings := currentRateLimitSettings()
	if settings.DailyLimitTriggerThreshold <= 0 || settings.BanDays <= 0 {
		return
	}
	ip := c.ClientIP()
	day := time.Now().Format("20060102")
	triggerCount := int64(1)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		defer cancel()
		key := fmt.Sprintf("limit:trigger:%s:%s", ip, day)
		count, err := cache.Client.Incr(ctx, key).Result()
		if err == nil {
			triggerCount = count
			_ = cache.Client.Expire(ctx, key, 48*time.Hour).Err()
		}
	}

	if dbCount, err := repository.CountDailySecurityEvents(ip, "limit", time.Now()); err == nil && dbCount > triggerCount {
		triggerCount = dbCount
	}
	if triggerCount < int64(settings.DailyLimitTriggerThreshold) {
		return
	}
	if activeBan, err := repository.FindActiveBan(ip); err == nil && activeBan != nil {
		return
	}

	expiresAt := time.Now().Add(time.Duration(settings.BanDays) * 24 * time.Hour)
	forgetNegativeBan(ip)
	if cache.Ready() {
		ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
		defer cancel()
		_ = cache.Client.Set(ctx, banKey(ip), category, time.Until(expiresAt)).Err()
	}
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:      "ban",
		Severity:  "critical",
		IP:        ip,
		Category:  category,
		Path:      c.Request.URL.RequestURI(),
		Method:    c.Request.Method,
		UserAgent: c.Request.UserAgent(),
		Message:   fmt.Sprintf("该 IP 当天触发限流 %d 次，已封禁 %d 天", settings.DailyLimitTriggerThreshold, settings.BanDays),
		Count:     triggerCount,
		Limit:     settings.DailyLimitTriggerThreshold,
		ExpiresAt: &expiresAt,
		CreatedAt: time.Now(),
	})
}

func limitResponse(c *gin.Context, category string, remaining int64) {
	message := limitMessage(category)
	c.JSON(http.StatusTooManyRequests, gin.H{
		"code":             "rate_limited",
		"category":         category,
		"message":          message,
		"remainingSeconds": remaining,
	})
	c.Abort()
}

func limitMessage(category string) string {
	if category == securityCategoryArticleUnlock {
		return "文章解锁尝试次数过多，请稍后重试"
	}
	if category == securityCategoryMusic || category == securityCategoryMusicStream {
		return "音乐访问次数过多，请稍后重试"
	}
	return "访问次数过多，请稍后重试"
}

func severityForCategory(category string) string {
	switch category {
	case securityCategoryArticleUnlock:
		return "high"
	case securityCategoryMusicStream:
		return "high"
	case securityCategoryMusic:
		return "warning"
	default:
		return "warning"
	}
}

func banKey(ip string) string {
	return "ban:ip:" + strings.TrimSpace(ip)
}

func limitKey(category, ip string) string {
	return "limit:" + category + ":" + strings.TrimSpace(ip)
}

func WriteTooManyLogin(c *gin.Context, username string) {
	settings := currentRateLimitSettings()
	remaining := int64(settings.LoginWindowSeconds)
	recordLimit(c, securityCategoryLogin, int64(settings.LoginMaxFailures), settings.LoginMaxFailures, time.Duration(settings.LoginWindowSeconds)*time.Second)
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:             "login_blocked",
		Severity:         "high",
		IP:               c.ClientIP(),
		Category:         securityCategoryLogin,
		Username:         username,
		Path:             c.Request.URL.RequestURI(),
		Method:           c.Request.Method,
		UserAgent:        c.Request.UserAgent(),
		Message:          "后台登录失败次数过多",
		Count:            int64(settings.LoginMaxFailures),
		Limit:            settings.LoginMaxFailures,
		RemainingSeconds: remaining,
	})
	c.JSON(http.StatusTooManyRequests, gin.H{
		"code":             "rate_limited",
		"category":         securityCategoryLogin,
		"message":          "登录失败次数过多，请稍后再试",
		"remainingSeconds": remaining,
	})
	c.Abort()
}

func RecordLoginSecurityEvent(c *gin.Context, username string, success bool, message string) {
	stat := model.SecurityAccessStat{
		Date:          time.Now().Format("20060102"),
		IP:            c.ClientIP(),
		Category:      securityCategoryLogin,
		LoginAttempts: 1,
	}
	eventType := "login_success"
	severity := "info"
	if !success {
		stat.LoginFailures = 1
		eventType = "login_failure"
		severity = "warning"
	}
	repository.RecordSecurityAccess(stat)
	repository.CreateSecurityEvent(&model.SecurityEvent{
		Type:      eventType,
		Severity:  severity,
		IP:        c.ClientIP(),
		Category:  securityCategoryLogin,
		Username:  username,
		Path:      c.Request.URL.RequestURI(),
		Method:    c.Request.Method,
		UserAgent: c.Request.UserAgent(),
		Message:   message,
	})
}
