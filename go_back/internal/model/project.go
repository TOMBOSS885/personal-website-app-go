package model

import "time"

type Project struct {
	ID           uint64    `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"column:name" json:"name"`
	Description  string    `gorm:"column:description" json:"description"`
	CoverImage   string    `gorm:"column:cover_image" json:"coverImage"`
	TechStack    string    `gorm:"column:tech_stack" json:"techStack"`
	GithubUrl    string    `gorm:"column:github_url" json:"githubUrl"`
	DemoUrl      string    `gorm:"column:demo_url" json:"demoUrl"`
	Stars        int       `gorm:"column:stars" json:"stars"`
	Featured     bool      `gorm:"column:featured" json:"featured"`
	DisplayOrder int       `gorm:"column:display_order" json:"displayOrder"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Project) TableName() string {
	return "projects"
}
