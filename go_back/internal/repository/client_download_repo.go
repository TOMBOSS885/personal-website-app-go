package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetClientDownloadSettings() (*model.ClientDownloadSettings, error) {
	var settings model.ClientDownloadSettings
	err := db.DB.First(&settings).Error
	return &settings, err
}

func CreateClientDownloadSettings(settings *model.ClientDownloadSettings) error {
	return db.DB.Create(settings).Error
}

func UpdateClientDownloadSettings(settings *model.ClientDownloadSettings) error {
	return db.DB.Save(settings).Error
}
