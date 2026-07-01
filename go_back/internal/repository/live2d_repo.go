package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetLive2DSettings() (*model.Live2DSettings, error) {
	var settings model.Live2DSettings
	err := db.DB.First(&settings).Error
	return &settings, err
}

func CreateLive2DSettings(settings *model.Live2DSettings) error {
	return db.DB.Create(settings).Error
}

func UpdateLive2DSettings(settings *model.Live2DSettings) error {
	return db.DB.Save(settings).Error
}

func GetLive2DModels(onlySwitchable, onlyActive bool) ([]model.Live2DModel, error) {
	var models []model.Live2DModel
	query := db.DB.Model(&model.Live2DModel{})
	if onlySwitchable {
		query = query.Where("switchable = ?", true)
	}
	if onlyActive {
		query = query.Where("active = ?", true)
	}
	err := query.Order("display_order ASC, created_at DESC").Find(&models).Error
	return models, err
}

func GetLive2DModelByID(id uint64) (*model.Live2DModel, error) {
	var m model.Live2DModel
	err := db.DB.First(&m, id).Error
	return &m, err
}

func CountLive2DModels() (int64, error) {
	var count int64
	err := db.DB.Model(&model.Live2DModel{}).Count(&count).Error
	return count, err
}

func DeactivateAllLive2DModels() error {
	return db.DB.Model(&model.Live2DModel{}).Where("1=1").Update("active", false).Error
}

func CreateLive2DModel(m *model.Live2DModel) error {
	return db.DB.Create(m).Error
}

func UpdateLive2DModel(m *model.Live2DModel) error {
	return db.DB.Save(m).Error
}

func DeleteLive2DModel(id uint64) error {
	return db.DB.Delete(&model.Live2DModel{}, id).Error
}
