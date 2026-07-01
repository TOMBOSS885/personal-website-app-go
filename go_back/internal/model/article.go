package model

import "time"

type Article struct {
	ID         uint64    `gorm:"primaryKey" json:"id"`
	Title      string    `gorm:"column:title" json:"title"`
	Summary    string    `gorm:"column:summary" json:"summary"`
	Content    string    `gorm:"column:content" json:"content"`
	CoverImage string    `gorm:"column:cover_image" json:"coverImage"`
	Category   string    `gorm:"column:category" json:"category"`
	Tags       string    `gorm:"column:tags" json:"tags"`
	Views      int       `gorm:"column:views" json:"views"`
	Published  bool      `gorm:"column:published" json:"published"`
	CreatedAt  time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}
