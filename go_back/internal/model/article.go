package model

import "time"

type Article struct {
	ID                 uint64    `gorm:"primaryKey" json:"id"`
	Title              string    `gorm:"column:title;size:255;not null" json:"title"`
	Summary            string    `gorm:"column:summary;size:500" json:"summary"`
	Content            string    `gorm:"column:content;type:text" json:"content"`
	CoverImage         string    `gorm:"column:cover_image;size:500" json:"coverImage"`
	Category           string    `gorm:"column:category;size:100" json:"category"`
	Tags               string    `gorm:"column:tags;size:500" json:"tags"`
	Views              int       `gorm:"column:views;default:0" json:"views"`
	Published          bool      `gorm:"column:published;default:false;index:idx_articles_published_created,priority:1" json:"published"`
	ContentType        string    `gorm:"column:content_type;size:20;default:markdown;not null;index" json:"contentType"`
	StaticSiteKey      string    `gorm:"column:static_site_key;size:64" json:"staticSiteKey,omitempty"`
	StaticSiteName     string    `gorm:"column:static_site_name;size:255" json:"staticSiteName,omitempty"`
	IsLocked           bool      `gorm:"column:is_locked;default:false;index" json:"isLocked"`
	AccessPasswordHash string    `gorm:"column:access_password_hash;size:255" json:"-"`
	CreatedAt          time.Time `gorm:"column:created_at;autoCreateTime;index:idx_articles_published_created,priority:2" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Article) TableName() string {
	return "articles"
}
