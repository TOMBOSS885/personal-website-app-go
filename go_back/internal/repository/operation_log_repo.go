package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"
	"time"
)

func CreateOperationLog(log *model.OperationLog) error {
	return db.DB.Create(log).Error
}

type OperationLogQuery struct {
	Page    int
	Size    int
	Action  string
	Keyword string
}

func GetOperationLogs(page, size int, action string) ([]model.OperationLog, int64, error) {
	return SearchOperationLogs(OperationLogQuery{Page: page, Size: size, Action: action})
}

func SearchOperationLogs(params OperationLogQuery) ([]model.OperationLog, int64, error) {
	var logs []model.OperationLog
	var total int64

	query := db.DB.Model(&model.OperationLog{})
	if action := strings.TrimSpace(params.Action); action != "" {
		query = query.Where("action = ?", action)
	}
	if keyword := strings.TrimSpace(params.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR action LIKE ? OR path LIKE ? OR ip LIKE ? OR message LIKE ?", like, like, like, like, like)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	page := params.Page
	size := params.Size
	if page < 0 {
		page = 0
	}
	if size <= 0 {
		size = 20
	}
	if size > 200 {
		size = 200
	}
	offset := page * size
	err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&logs).Error
	return logs, total, err
}

func CleanupOperationLogs() {
	now := time.Now()
	criticalActions := []string{
		"login_success",
		"login_failed",
		"login_blocked",
		"login_2fa_required",
		"login_2fa_failed",
		"login_2fa_success",
		"change_password",
		"delete_article",
		"delete_project",
		"delete_skill",
		"delete_feature_card",
		"delete_music",
		"delete_music_lyrics",
		"delete_background_image",
		"delete_live2d_model",
	}
	_ = db.DB.Where("created_at < ? AND action NOT IN ?", now.AddDate(0, -6, 0), criticalActions).
		Delete(&model.OperationLog{}).Error
	_ = db.DB.Where("created_at < ? AND action IN ?", now.AddDate(-1, 0, 0), criticalActions).
		Delete(&model.OperationLog{}).Error
}
