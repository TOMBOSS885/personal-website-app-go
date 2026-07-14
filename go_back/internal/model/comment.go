package model

import "time"

type Comment struct {
	ID        uint64     `gorm:"primaryKey" json:"id"`
	ArticleID uint64     `gorm:"column:article_id;not null;index:idx_comments_article_status_time,priority:1;index" json:"articleId"`
	UserID    uint64     `gorm:"column:user_id;not null;index" json:"userId"`
	ParentID  *uint64    `gorm:"column:parent_id;index" json:"parentId,omitempty"`
	Content   string     `gorm:"column:content;type:varchar(1200);not null" json:"content"`
	Status    string     `gorm:"column:status;size:20;default:visible;not null;index:idx_comments_article_status_time,priority:2;index" json:"status"`
	CreatedAt time.Time  `gorm:"column:created_at;autoCreateTime;index:idx_comments_article_status_time,priority:3" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	DeletedAt *time.Time `gorm:"column:deleted_at;index" json:"-"`
}

func (Comment) TableName() string { return "comments" }

type CommentView struct {
	ID           uint64    `json:"id"`
	ArticleID    uint64    `json:"articleId"`
	UserID       uint64    `json:"userId"`
	ParentID     *uint64   `json:"parentId,omitempty"`
	Content      string    `json:"content"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Username     string    `json:"username"`
	ArticleTitle string    `json:"articleTitle,omitempty"`
}
