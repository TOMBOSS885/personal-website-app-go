package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func CreateOperationLog(log *model.OperationLog) error {
	return db.DB.Create(log).Error
}

func GetOperationLogs(page, size int, action string) ([]model.OperationLog, int64, error) {
	var logs []model.OperationLog
	var total int64

	query := db.DB.Model(&model.OperationLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.Order("created_at DESC").Offset(offset).Limit(size).Find(&logs).Error
	return logs, total, err
}
