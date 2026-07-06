package model

import "time"

type UploadAsset struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	Kind      string    `gorm:"column:kind;size:50;not null;index:idx_upload_assets_kind_time,priority:1" json:"kind"`
	Name      string    `gorm:"column:name;size:255;not null" json:"name"`
	URL       string    `gorm:"column:url;size:512;not null;uniqueIndex" json:"url"`
	Path      string    `gorm:"column:path;size:1000" json:"-"`
	Size      int64     `gorm:"column:size;default:0" json:"size"`
	GroupKey  string    `gorm:"column:group_key;size:255;index" json:"groupKey,omitempty"`
	Variant   string    `gorm:"column:variant;size:50;index" json:"variant,omitempty"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;index:idx_upload_assets_kind_time,priority:2" json:"createdAt"`
}

func (UploadAsset) TableName() string {
	return "upload_assets"
}
