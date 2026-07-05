package handler

import (
	"context"
	"personal-website-go/internal/cache"
	"personal-website-go/internal/middleware"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"
	"personal-website-go/internal/response"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type activeRestriction struct {
	Key              string `json:"key"`
	IP               string `json:"ip"`
	Category         string `json:"category"`
	Type             string `json:"type"`
	Value            string `json:"value"`
	RemainingSeconds int64  `json:"remainingSeconds"`
	Severity         string `json:"severity"`
}

func AdminSecurityDashboard(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "0"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "30"))
	keyword := c.Query("keyword")
	date := c.DefaultQuery("date", time.Now().Format("20060102"))
	view := strings.TrimSpace(c.DefaultQuery("view", "stats"))

	settings, _ := repository.GetOrCreateRateLimitSettings()
	events := []model.SecurityEvent{}
	stats := []model.SecurityAccessStat{}
	var totalEvents int64
	var totalStats int64
	if view == "events" || view == "all" {
		events, totalEvents, _ = repository.SearchSecurityEvents(keyword, c.Query("type"), c.Query("severity"), page, size)
	}
	if view == "stats" || view == "all" {
		stats, totalStats, _ = repository.SearchSecurityStats(keyword, date, page, size)
	}
	highAccess := []model.SecurityAccessStat{}
	highAccessThresholds := repository.HighAccessThresholds{}
	if settings != nil {
		highAccessThresholds = repository.BuildHighAccessThresholds(*settings)
		highAccess, _ = repository.GetHighAccessStatsByRateLimit(date, *settings)
	}

	response.Success(c, gin.H{
		"settings":           settings,
		"events":             events,
		"eventsTotal":        totalEvents,
		"stats":              stats,
		"statsTotal":         totalStats,
		"highAccess":         highAccess,
		"highAccessRules":    highAccessThresholds,
		"activeRestrictions": listActiveRestrictions(),
		"date":               date,
	})
}

func AdminGetRateLimitSettings(c *gin.Context) {
	settings, err := repository.GetOrCreateRateLimitSettings()
	if err != nil {
		response.Error(c, 500, "获取限流设置失败")
		return
	}
	response.Success(c, settings)
}

func AdminUpdateRateLimitSettings(c *gin.Context) {
	var payload model.RateLimitSettings
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.Error(c, 400, "参数错误")
		return
	}

	existing, err := repository.GetOrCreateRateLimitSettings()
	if err != nil {
		response.Error(c, 500, "获取限流设置失败")
		return
	}
	existing.Enabled = payload.Enabled
	existing.PublicPerMinute = payload.PublicPerMinute
	existing.MusicPerMinute = payload.MusicPerMinute
	existing.MusicStreamPerMinute = payload.MusicStreamPerMinute
	existing.LoginMaxFailures = payload.LoginMaxFailures
	existing.LoginWindowSeconds = payload.LoginWindowSeconds
	existing.DailyLimitTriggerThreshold = payload.DailyLimitTriggerThreshold
	existing.BanDays = payload.BanDays

	if err := repository.SaveRateLimitSettings(existing); err != nil {
		response.Error(c, 500, "保存限流设置失败")
		return
	}
	middleware.ClearRateLimitSettingsCache()
	response.Success(c, existing)
}

func listActiveRestrictions() []activeRestriction {
	items := make([]activeRestriction, 0)
	seen := map[string]bool{}
	if bans, err := repository.ListActiveBans(); err == nil {
		for _, ban := range bans {
			remaining := int64(0)
			if ban.ExpiresAt != nil {
				remaining = int64(time.Until(*ban.ExpiresAt).Seconds())
			}
			if remaining > 0 {
				seen["ban:"+ban.IP] = true
				items = append(items, activeRestriction{
					Key:              "db:ban:" + ban.IP,
					IP:               ban.IP,
					Category:         "all",
					Type:             "ban",
					Value:            ban.Message,
					RemainingSeconds: remaining,
					Severity:         "critical",
				})
			}
		}
	}
	if !cache.Ready() {
		return items
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	for _, prefix := range []string{"limit:*", "ban:ip:*"} {
		var cursor uint64
		for {
			keys, next, err := cache.Client.Scan(ctx, cursor, prefix, 100).Result()
			if err != nil {
				return items
			}
			for _, key := range keys {
				ttl, err := cache.Client.TTL(ctx, key).Result()
				if err != nil || ttl <= 0 {
					continue
				}
				value, _ := cache.Client.Get(ctx, key).Result()
				item := restrictionFromKey(key, value, ttl)
				seenKey := item.Type + ":" + item.Category + ":" + item.IP
				if item.Type == "ban" {
					seenKey = "ban:" + item.IP
				}
				if seen[seenKey] {
					continue
				}
				seen[seenKey] = true
				items = append(items, item)
			}
			cursor = next
			if cursor == 0 {
				break
			}
		}
	}
	return items
}

func restrictionFromKey(key, value string, ttl time.Duration) activeRestriction {
	item := activeRestriction{
		Key:              key,
		Value:            value,
		RemainingSeconds: int64(ttl.Seconds()),
		Severity:         "warning",
	}
	if strings.HasPrefix(key, "ban:ip:") {
		item.Type = "ban"
		item.Category = "all"
		item.IP = strings.TrimPrefix(key, "ban:ip:")
		item.Severity = "critical"
		return item
	}
	if strings.HasPrefix(key, "limit:") {
		item.Type = "limit"
		raw := strings.TrimPrefix(key, "limit:")
		parts := strings.SplitN(raw, ":", 2)
		if len(parts) == 2 {
			item.Category = parts[0]
			item.IP = parts[1]
		}
		if item.Category == "music-stream" {
			item.Severity = "high"
		}
	}
	return item
}
