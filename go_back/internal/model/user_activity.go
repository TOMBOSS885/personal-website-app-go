package model

import "time"

type UserActivity struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	UserID    uint64    `gorm:"column:user_id;not null;index:idx_user_activity_user_time,priority:1;index" json:"userId"`
	Action    string    `gorm:"column:action;size:60;not null;index:idx_user_activity_action_time,priority:1;index" json:"action"`
	Resource  string    `gorm:"column:resource;size:100" json:"resource"`
	Detail    string    `gorm:"column:detail;size:500" json:"detail"`
	IP        string    `gorm:"column:ip;size:100;index" json:"ip"`
	UserAgent string    `gorm:"column:user_agent;size:500" json:"userAgent"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;index:idx_user_activity_user_time,priority:2;index:idx_user_activity_action_time,priority:2;index" json:"createdAt"`
}

func (UserActivity) TableName() string { return "user_activities" }

type UserActivityView struct {
	UserActivity
	Username string `json:"username"`
	Email    string `json:"email"`
}
