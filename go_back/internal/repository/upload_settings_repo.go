package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetUploadSettings() (*model.UploadSettings, error) {
	var settings model.UploadSettings
	err := db.DB.First(&settings).Error
	return &settings, err
}

func CreateUploadSettings(settings *model.UploadSettings) error {
	return db.DB.Create(settings).Error
}

func UpdateUploadSettings(settings *model.UploadSettings) error {
	return db.DB.Save(settings).Error
}
