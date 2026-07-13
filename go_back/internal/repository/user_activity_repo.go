package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"
	"time"
)

func CreateUserActivity(activity *model.UserActivity) error {
	if activity == nil || activity.UserID == 0 {
		return nil
	}
	return db.DB.Create(activity).Error
}

func CleanupUserActivityData(now time.Time) {
	if now.IsZero() {
		now = time.Now()
	}
	_ = db.DB.Where("created_at < ?", now.AddDate(0, -6, 0)).Delete(&model.UserActivity{}).Error
	_ = db.DB.Unscoped().Where("deleted_at IS NOT NULL AND deleted_at < ?", now.AddDate(0, -1, 0)).Delete(&model.Comment{}).Error
}

func ListUserActivities(keyword, action string, page, size int) ([]model.UserActivityView, int64, error) {
	var items []model.UserActivityView
	var total int64
	query := db.DB.Table("user_activities AS ua").
		Joins("LEFT JOIN users AS u ON u.id = ua.user_id")
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("u.username LIKE ? OR u.email LIKE ? OR ua.ip LIKE ? OR ua.detail LIKE ?", like, like, like, like)
	}
	if action = strings.TrimSpace(action); action != "" {
		query = query.Where("ua.action = ?", action)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 0 {
		page = 0
	}
	if size <= 0 || size > 100 {
		size = 30
	}
	err := query.Select("ua.*, u.username, u.email").Order("ua.created_at DESC").Offset(page * size).Limit(size).Scan(&items).Error
	return items, total, err
}
