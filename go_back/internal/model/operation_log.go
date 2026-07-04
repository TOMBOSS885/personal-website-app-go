package model

import "time"

type OperationLog struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	Username  string    `gorm:"column:username;size:100;index" json:"username"`
	Action    string    `gorm:"column:action;size:100;index" json:"action"`
	Method    string    `gorm:"column:method;size:20" json:"method"`
	Path      string    `gorm:"column:path;size:500" json:"path"`
	Target    string    `gorm:"column:target;size:255" json:"target"`
	IP        string    `gorm:"column:ip;size:100" json:"ip"`
	UserAgent string    `gorm:"column:user_agent;size:500" json:"userAgent"`
	Status    int       `gorm:"column:status" json:"status"`
	Message   string    `gorm:"column:message;size:500" json:"message"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;index" json:"createdAt"`
}

func (OperationLog) TableName() string {
	return "operation_logs"
}
