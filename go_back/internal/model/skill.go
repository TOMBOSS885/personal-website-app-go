package model

type Skill struct {
	ID           uint64 `gorm:"primaryKey" json:"id"`
	Name         string `gorm:"column:name;size:255;not null" json:"name"`
	Category     string `gorm:"column:category;size:100" json:"category"`
	Proficiency  int    `gorm:"column:proficiency" json:"proficiency"`
	Icon         string `gorm:"column:icon;size:500" json:"icon"`
	DisplayOrder int    `gorm:"column:display_order;default:0" json:"displayOrder"`
}

func (Skill) TableName() string {
	return "skills"
}
