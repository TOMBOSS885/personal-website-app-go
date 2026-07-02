package model

import "time"

type Project struct {
	ID           uint64    `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"column:name;size:255;not null" json:"name"`
	Description  string    `gorm:"column:description;size:500" json:"description"`
	CoverImage   string    `gorm:"column:cover_image;size:500" json:"coverImage"`
	TechStack    string    `gorm:"column:tech_stack;size:500" json:"techStack"`
	GithubUrl    string    `gorm:"column:github_url;size:255" json:"githubUrl"`
	DemoUrl      string    `gorm:"column:demo_url;size:255" json:"demoUrl"`
	Stars        int       `gorm:"column:stars;default:0" json:"stars"`
	Featured     bool      `gorm:"column:featured;default:false" json:"featured"`
	DisplayOrder int       `gorm:"column:display_order;default:0" json:"displayOrder"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Project) TableName() string {
	return "projects"
}
