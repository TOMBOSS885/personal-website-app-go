package model

import "time"

type ClientDownloadSettings struct {
	ID          uint64    `gorm:"primaryKey" json:"id"`
	Enabled     bool      `gorm:"column:enabled;default:false;not null" json:"enabled"`
	DownloadURL string    `gorm:"column:download_url;size:2048" json:"downloadUrl"`
	Version     string    `gorm:"column:version;size:100" json:"version"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (ClientDownloadSettings) TableName() string {
	return "client_download_settings"
}
