package model

type FeatureCard struct {
	ID            uint64 `gorm:"primaryKey" json:"id"`
	Title         string `gorm:"column:title;size:255;not null" json:"title"`
	TitleEn       string `gorm:"column:title_en;size:255" json:"titleEn"`
	Description   string `gorm:"column:description;size:500" json:"description"`
	DescriptionEn string `gorm:"column:description_en;size:500" json:"descriptionEn"`
	Icon          string `gorm:"column:icon;size:100" json:"icon"`
	Gradient      string `gorm:"column:gradient;size:100" json:"gradient"`
	DisplayOrder  int    `gorm:"column:display_order;default:0" json:"displayOrder"`
	Enabled       bool   `gorm:"column:enabled;default:true" json:"enabled"`
}

func (FeatureCard) TableName() string {
	return "feature_cards"
}
