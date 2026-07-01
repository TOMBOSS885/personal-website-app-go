package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetFeatureCards(onlyEnabled bool) ([]model.FeatureCard, error) {
	var cards []model.FeatureCard
	query := db.DB.Model(&model.FeatureCard{})
	if onlyEnabled {
		query = query.Where("enabled = ?", true)
	}
	err := query.Order("display_order ASC").Find(&cards).Error
	return cards, err
}

func GetFeatureCardByID(id uint64) (*model.FeatureCard, error) {
	var card model.FeatureCard
	err := db.DB.First(&card, id).Error
	return &card, err
}

func CreateFeatureCard(card *model.FeatureCard) error {
	return db.DB.Create(card).Error
}

func UpdateFeatureCard(card *model.FeatureCard) error {
	return db.DB.Save(card).Error
}

func DeleteFeatureCard(id uint64) error {
	return db.DB.Delete(&model.FeatureCard{}, id).Error
}
