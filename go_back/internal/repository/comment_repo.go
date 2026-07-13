package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"
	"time"

	"gorm.io/gorm"
)

func CreateComment(comment *model.Comment) error { return db.DB.Create(comment).Error }

func GetCommentByID(id uint64) (*model.Comment, error) {
	var comment model.Comment
	err := db.DB.Where("id = ? AND deleted_at IS NULL", id).First(&comment).Error
	return &comment, err
}

func ListArticleComments(articleID uint64, page, size int) ([]model.CommentView, int64, int64, error) {
	if page < 0 {
		page = 0
	}
	if size <= 0 || size > 50 {
		size = 20
	}

	visibleQuery := func() *gorm.DB {
		return db.DB.Model(&model.Comment{}).
			Where("article_id = ? AND status = ? AND deleted_at IS NULL", articleID, "visible")
	}
	rootCondition := "(parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM comments AS parent WHERE parent.id = comments.parent_id AND parent.status = 'visible' AND parent.deleted_at IS NULL))"
	var totalComments int64
	if err := visibleQuery().Count(&totalComments).Error; err != nil {
		return nil, 0, 0, err
	}
	var totalThreads int64
	if err := visibleQuery().Where(rootCondition).Count(&totalThreads).Error; err != nil {
		return nil, 0, 0, err
	}

	var rootIDs []uint64
	if err := visibleQuery().Where(rootCondition).
		Order("created_at DESC, id DESC").Offset(page*size).Limit(size).Pluck("id", &rootIDs).Error; err != nil {
		return nil, 0, 0, err
	}
	if len(rootIDs) == 0 {
		return []model.CommentView{}, totalComments, totalThreads, nil
	}

	var comments []model.CommentView
	err := db.DB.Table("comments AS c").
		Select("c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status, c.created_at, c.updated_at, u.username, u.avatar").
		Joins("JOIN users AS u ON u.id = c.user_id").
		Where("c.article_id = ? AND c.status = ? AND c.deleted_at IS NULL AND (c.id IN ? OR c.parent_id IN ?)", articleID, "visible", rootIDs, rootIDs).
		Order("c.created_at ASC, c.id ASC").
		Scan(&comments).Error
	return comments, totalComments, totalThreads, err
}

func ListAdminComments(keyword, status string, page, size int) ([]model.CommentView, int64, error) {
	var comments []model.CommentView
	var total int64
	query := db.DB.Table("comments AS c").
		Joins("JOIN users AS u ON u.id = c.user_id").
		Joins("JOIN articles AS a ON a.id = c.article_id").
		Where("c.deleted_at IS NULL")
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("c.content LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR a.title LIKE ?", like, like, like, like)
	}
	if status = strings.TrimSpace(status); status != "" {
		query = query.Where("c.status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 0 {
		page = 0
	}
	if size <= 0 || size > 100 {
		size = 30
	}
	err := query.Select("c.id, c.article_id, c.user_id, c.parent_id, c.content, c.status, c.created_at, c.updated_at, u.username, u.avatar, a.title AS article_title").
		Order("c.created_at DESC").Offset(page * size).Limit(size).Scan(&comments).Error
	return comments, total, err
}

func CountRecentCommentsByUser(userID uint64, since time.Time) (int64, error) {
	var count int64
	err := db.DB.Model(&model.Comment{}).Where("user_id = ? AND created_at >= ? AND deleted_at IS NULL", userID, since).Count(&count).Error
	return count, err
}

func UpdateCommentContent(id, userID uint64, content string, updatedBefore time.Time) (int64, error) {
	result := db.DB.Model(&model.Comment{}).
		Where("id = ? AND user_id = ? AND created_at >= ? AND deleted_at IS NULL", id, userID, updatedBefore).
		Updates(map[string]interface{}{"content": content, "updated_at": time.Now()})
	return result.RowsAffected, result.Error
}

func SoftDeleteComment(id, userID uint64, admin bool) (int64, error) {
	query := db.DB.Model(&model.Comment{}).Where("id = ? AND deleted_at IS NULL", id)
	if !admin {
		query = query.Where("user_id = ?", userID)
	}
	result := query.Updates(map[string]interface{}{"deleted_at": time.Now(), "status": "deleted"})
	return result.RowsAffected, result.Error
}

func UpdateCommentStatus(id uint64, status string) error {
	return db.DB.Model(&model.Comment{}).Where("id = ? AND deleted_at IS NULL", id).Update("status", status).Error
}
