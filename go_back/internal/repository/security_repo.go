package repository

import (
	"errors"
	"personal-website-go/internal/config"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func GetOrCreateRateLimitSettings() (*model.RateLimitSettings, error) {
	var settings model.RateLimitSettings
	err := db.DB.First(&settings).Error
	if err == nil {
		normalizeRateLimitSettings(&settings)
		return &settings, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	settings = model.RateLimitSettings{
		Enabled:                    true,
		PublicPerMinute:            config.AppConfig.PublicRateLimit,
		MusicPerMinute:             config.AppConfig.MusicRateLimit,
		MusicStreamPerMinute:       config.AppConfig.MusicStreamRateLimit,
		LoginMaxFailures:           config.AppConfig.LoginLimitMaxFails,
		LoginWindowSeconds:         config.AppConfig.LoginLimitWindow,
		DailyLimitTriggerThreshold: 5,
		BanDays:                    30,
	}
	normalizeRateLimitSettings(&settings)
	if err := db.DB.Create(&settings).Error; err != nil {
		return nil, err
	}
	return &settings, nil
}

func SaveRateLimitSettings(settings *model.RateLimitSettings) error {
	normalizeRateLimitSettings(settings)
	if settings.ID == 0 {
		settings.ID = 1
	}
	return db.DB.Save(settings).Error
}

func RecordSecurityAccess(stat model.SecurityAccessStat) {
	if strings.TrimSpace(stat.Date) == "" {
		stat.Date = time.Now().Format("20060102")
	}
	stat.LastSeenAt = time.Now()
	db.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "date"},
			{Name: "ip"},
			{Name: "category"},
			{Name: "music_id"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"count":          gorm.Expr("count + ?", stat.Count),
			"limited_count":  gorm.Expr("limited_count + ?", stat.LimitedCount),
			"blocked_count":  gorm.Expr("blocked_count + ?", stat.BlockedCount),
			"login_attempts": gorm.Expr("login_attempts + ?", stat.LoginAttempts),
			"login_failures": gorm.Expr("login_failures + ?", stat.LoginFailures),
			"music_title":    stat.MusicTitle,
			"last_seen_at":   stat.LastSeenAt,
			"updated_at":     time.Now(),
		}),
	}).Create(&stat)
}

func CreateSecurityEvent(event *model.SecurityEvent) {
	if strings.TrimSpace(event.Severity) == "" {
		event.Severity = "info"
	}
	_ = db.DB.Create(event).Error
}

func CountDailySecurityEvents(ip, eventType string, day time.Time) (int64, error) {
	var total int64
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)
	query := db.DB.Model(&model.SecurityEvent{}).
		Where("ip = ? AND created_at >= ? AND created_at < ?", strings.TrimSpace(ip), start, end)
	if eventType = strings.TrimSpace(eventType); eventType != "" {
		query = query.Where("type = ?", eventType)
	}
	err := query.Count(&total).Error
	return total, err
}

func SearchSecurityEvents(keyword, eventType, severity string, page, size int) ([]model.SecurityEvent, int64, error) {
	var events []model.SecurityEvent
	var total int64
	query := db.DB.Model(&model.SecurityEvent{})
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("ip LIKE ? OR username LIKE ? OR message LIKE ? OR path LIKE ? OR music_title LIKE ?", like, like, like, like, like)
	}
	if eventType = strings.TrimSpace(eventType); eventType != "" {
		query = query.Where("type = ?", eventType)
	}
	if severity = strings.TrimSpace(severity); severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if size <= 0 {
		size = 20
	}
	if size > 100 {
		size = 100
	}
	if page < 0 {
		page = 0
	}
	err := query.Order("created_at DESC").Offset(page * size).Limit(size).Find(&events).Error
	return events, total, err
}

func SearchSecurityStats(keyword, date string, page, size int) ([]model.SecurityAccessStat, int64, error) {
	var stats []model.SecurityAccessStat
	var total int64
	query := db.DB.Model(&model.SecurityAccessStat{})
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("ip LIKE ? OR category LIKE ? OR music_title LIKE ?", like, like, like)
	}
	if date = strings.TrimSpace(date); date != "" {
		query = query.Where("date = ?", date)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if size <= 0 {
		size = 50
	}
	if size > 200 {
		size = 200
	}
	if page < 0 {
		page = 0
	}
	err := query.Order("date DESC, count DESC, limited_count DESC").Offset(page * size).Limit(size).Find(&stats).Error
	return stats, total, err
}

func GetHighAccessStats(date string, threshold int) ([]model.SecurityAccessStat, error) {
	if date == "" {
		date = time.Now().Format("20060102")
	}
	if threshold <= 0 {
		threshold = 100
	}
	var stats []model.SecurityAccessStat
	err := db.DB.Where("date = ? AND count >= ?", date, threshold).
		Order("count DESC").
		Limit(20).
		Find(&stats).Error
	return stats, err
}

type HighAccessThresholds struct {
	Public          int `json:"public"`
	Music           int `json:"music"`
	MusicStream     int `json:"musicStream"`
	MusicStreamSong int `json:"musicStreamSong"`
}

func BuildHighAccessThresholds(settings model.RateLimitSettings) HighAccessThresholds {
	normalizeRateLimitSettings(&settings)
	return HighAccessThresholds{
		Public:          settings.PublicPerMinute * 10,
		Music:           settings.MusicPerMinute * 10,
		MusicStream:     settings.MusicStreamPerMinute * 10,
		MusicStreamSong: settings.MusicStreamPerMinute * 10,
	}
}

func GetHighAccessStatsByRateLimit(date string, settings model.RateLimitSettings) ([]model.SecurityAccessStat, error) {
	if date == "" {
		date = time.Now().Format("20060102")
	}
	thresholds := BuildHighAccessThresholds(settings)
	var stats []model.SecurityAccessStat
	err := db.DB.Where("date = ?", date).
		Where(
			"(category = ? AND count > ?) OR (category = ? AND count > ?) OR (category = ? AND count > ?) OR (category = ? AND count > ?)",
			"public", thresholds.Public,
			"music", thresholds.Music,
			"music-stream", thresholds.MusicStream,
			"music-stream-song", thresholds.MusicStreamSong,
		).
		Order("count DESC").
		Limit(20).
		Find(&stats).Error
	return stats, err
}

func FindActiveBan(ip string) (*model.SecurityEvent, error) {
	var event model.SecurityEvent
	result := db.DB.Where("type = ? AND ip = ? AND expires_at > ?", "ban", ip, time.Now()).
		Order("created_at DESC").
		Limit(1).
		Find(&event)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &event, nil
}

func ListActiveBans() ([]model.SecurityEvent, error) {
	var events []model.SecurityEvent
	err := db.DB.Where("type = ? AND expires_at > ?", "ban", time.Now()).
		Order("expires_at DESC").
		Limit(200).
		Find(&events).Error
	return events, err
}

func CleanupSecurityLogs() {
	now := time.Now()
	_ = db.DB.Where("created_at < ? AND type NOT IN ?", now.AddDate(0, -1, 0), []string{"limit", "ban"}).Delete(&model.SecurityEvent{}).Error
	_ = db.DB.Where("created_at < ? AND type IN ?", now.AddDate(-1, 0, 0), []string{"limit", "ban"}).Delete(&model.SecurityEvent{}).Error
	_ = db.DB.Where("date < ?", now.AddDate(0, -1, 0).Format("20060102")).Delete(&model.SecurityAccessStat{}).Error
}

func normalizeRateLimitSettings(settings *model.RateLimitSettings) {
	if settings.PublicPerMinute <= 0 {
		settings.PublicPerMinute = 180
	}
	if settings.MusicPerMinute <= 0 {
		settings.MusicPerMinute = 90
	}
	if settings.MusicStreamPerMinute <= 0 {
		settings.MusicStreamPerMinute = 240
	}
	if settings.LoginMaxFailures <= 0 {
		settings.LoginMaxFailures = 5
	}
	if settings.LoginWindowSeconds <= 0 {
		settings.LoginWindowSeconds = 600
	}
	if settings.DailyLimitTriggerThreshold <= 0 {
		settings.DailyLimitTriggerThreshold = 5
	}
	if settings.BanDays <= 0 {
		settings.BanDays = 30
	}
}
