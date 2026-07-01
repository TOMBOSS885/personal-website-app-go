package model

type Skill struct {
	ID           uint64 `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"column:name" json:"name"`
	Category     string `gorm:"column:category" json:"category"`
	Proficiency  int    `gorm:"column:proficiency" json:"proficiency"`
	Icon         string `gorm:"column:icon" json:"icon"`
	DisplayOrder int    `gorm:"column:display_order" json:"displayOrder"`
}
