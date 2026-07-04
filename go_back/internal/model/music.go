package model

import "time"

type Music struct {
	ID           uint64    `gorm:"primaryKey" json:"id"`
	Title        string    `gorm:"column:title;size:255;not null" json:"title"`
	Artist       string    `gorm:"column:artist;size:255" json:"artist"`
	FileURL      string    `gorm:"column:file_url;size:500;not null" json:"fileUrl"`
	FileName     string    `gorm:"column:file_name;size:255" json:"fileName"`
	ContentType  string    `gorm:"column:content_type;size:100" json:"contentType"`
	Size         int64     `gorm:"column:size;default:0" json:"size"`
	LyricsURL    string    `gorm:"column:lyrics_url;size:500" json:"lyricsUrl"`
	LyricsName   string    `gorm:"column:lyrics_name;size:255" json:"lyricsName"`
	LyricsSize   int64     `gorm:"column:lyrics_size;default:0" json:"lyricsSize"`
	IsPublic     bool      `gorm:"column:is_public;default:true;not null" json:"isPublic"`
	DisplayOrder int       `gorm:"column:display_order;default:0" json:"displayOrder"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Music) TableName() string {
	return "musics"
}
