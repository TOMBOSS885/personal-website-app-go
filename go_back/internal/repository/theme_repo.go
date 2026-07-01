package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetActiveTheme() (*model.Theme, error) {
	var theme model.Theme
	err := db.DB.Where("is_active = ?", true).First(&theme).Error
	return &theme, err
}

func GetAllThemes() ([]model.Theme, error) {
	var themes []model.Theme
	err := db.DB.Find(&themes).Error
	return themes, err
}

func DeactivateAllThemes() error {
	return db.DB.Model(&model.Theme{}).Where("1=1").Update("is_active", false).Error
}

func CreateTheme(theme *model.Theme) error {
	return db.DB.Create(theme).Error
}
