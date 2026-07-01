package model

type FeatureCard struct {
	ID            uint64 `gorm:"primaryKey" json:"id"`
	Title         string `gorm:"column:title" json:"title"`
	TitleEn       string `gorm:"column:title_en" json:"titleEn"`
	Description   string `gorm:"column:description" json:"description"`
	DescriptionEn string `gorm:"column:description_en" json:"descriptionEn"`
	Icon          string `gorm:"column:icon" json:"icon"`
	Gradient      string `gorm:"column:gradient" json:"gradient"`
	DisplayOrder  int    `gorm:"column:display_order" json:"displayOrder"`
	Enabled       bool   `gorm:"column:enabled" json:"enabled"`
}
