package model

import "time"

type RateLimitSettings struct {
	ID                         uint64    `gorm:"primaryKey" json:"id"`
	Enabled                    bool      `gorm:"column:enabled;default:true;not null" json:"enabled"`
	PublicPerMinute            int       `gorm:"column:public_per_minute;default:180;not null" json:"publicPerMinute"`
	MusicPerMinute             int       `gorm:"column:music_per_minute;default:90;not null" json:"musicPerMinute"`
	MusicStreamPerMinute       int       `gorm:"column:music_stream_per_minute;default:240;not null" json:"musicStreamPerMinute"`
	LoginMaxFailures           int       `gorm:"column:login_max_failures;default:5;not null" json:"loginMaxFailures"`
	LoginWindowSeconds         int       `gorm:"column:login_window_seconds;default:600;not null" json:"loginWindowSeconds"`
	DailyLimitTriggerThreshold int       `gorm:"column:daily_limit_trigger_threshold;default:5;not null" json:"dailyLimitTriggerThreshold"`
	BanDays                    int       `gorm:"column:ban_days;default:30;not null" json:"banDays"`
	UpdatedAt                  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (RateLimitSettings) TableName() string {
	return "rate_limit_settings"
}

type SecurityAccessStat struct {
	ID            uint64    `gorm:"primaryKey" json:"id"`
	Date          string    `gorm:"column:date;size:8;index:idx_security_stat_unique,unique;index;index:idx_security_stats_date_count,priority:1" json:"date"`
	IP            string    `gorm:"column:ip;size:100;index:idx_security_stat_unique,unique;index;index:idx_security_stats_ip_date,priority:1" json:"ip"`
	Category      string    `gorm:"column:category;size:50;index:idx_security_stat_unique,unique;index;index:idx_security_stats_category_date,priority:1" json:"category"`
	MusicID       uint64    `gorm:"column:music_id;default:0;index:idx_security_stat_unique,unique;index" json:"musicId"`
	MusicTitle    string    `gorm:"column:music_title;size:255" json:"musicTitle"`
	Count         int64     `gorm:"column:count;default:0;index:idx_security_stats_date_count,priority:2" json:"count"`
	LimitedCount  int64     `gorm:"column:limited_count;default:0" json:"limitedCount"`
	BlockedCount  int64     `gorm:"column:blocked_count;default:0" json:"blockedCount"`
	LoginAttempts int64     `gorm:"column:login_attempts;default:0" json:"loginAttempts"`
	LoginFailures int64     `gorm:"column:login_failures;default:0" json:"loginFailures"`
	LastSeenAt    time.Time `gorm:"column:last_seen_at;index;index:idx_security_stats_ip_date,priority:2;index:idx_security_stats_category_date,priority:2" json:"lastSeenAt"`
	CreatedAt     time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (SecurityAccessStat) TableName() string {
	return "security_access_stats"
}

type SecurityEvent struct {
	ID               uint64     `gorm:"primaryKey" json:"id"`
	Type             string     `gorm:"column:type;size:50;index;index:idx_security_events_ip_type_time,priority:2;index:idx_security_events_type_time,priority:1;index:idx_security_events_active_ban,priority:1" json:"type"`
	Severity         string     `gorm:"column:severity;size:20;index;index:idx_security_events_severity_time,priority:1" json:"severity"`
	IP               string     `gorm:"column:ip;size:100;index;index:idx_security_events_ip_type_time,priority:1;index:idx_security_events_active_ban,priority:2" json:"ip"`
	Category         string     `gorm:"column:category;size:50;index" json:"category"`
	Username         string     `gorm:"column:username;size:100;index" json:"username"`
	MusicID          uint64     `gorm:"column:music_id;default:0;index" json:"musicId"`
	MusicTitle       string     `gorm:"column:music_title;size:255" json:"musicTitle"`
	Path             string     `gorm:"column:path;size:500" json:"path"`
	Method           string     `gorm:"column:method;size:20" json:"method"`
	UserAgent        string     `gorm:"column:user_agent;size:500" json:"userAgent"`
	Message          string     `gorm:"column:message;size:500" json:"message"`
	Count            int64      `gorm:"column:count;default:0" json:"count"`
	Limit            int        `gorm:"column:limit_value;default:0" json:"limit"`
	RemainingSeconds int64      `gorm:"column:remaining_seconds;default:0" json:"remainingSeconds"`
	ExpiresAt        *time.Time `gorm:"column:expires_at;index;index:idx_security_events_active_ban,priority:3" json:"expiresAt"`
	CreatedAt        time.Time  `gorm:"column:created_at;autoCreateTime;index;index:idx_security_events_ip_type_time,priority:3;index:idx_security_events_type_time,priority:2;index:idx_security_events_severity_time,priority:2" json:"createdAt"`
}

func (SecurityEvent) TableName() string {
	return "security_events"
}
