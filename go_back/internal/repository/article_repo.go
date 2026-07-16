package repository

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetArticles(page, size int, tag string, onlyPublished bool) ([]model.Article, int64, error) {
	var articles []model.Article
	var total int64

	query := db.DB.Model(&model.Article{})
	if onlyPublished {
		query = query.Where("published = ?", true)
	}
	if tag != "" {
		query = query.Where("FIND_IN_SET(?, REPLACE(tags, ' ', '')) > 0", tag)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.Order("created_at DESC").Offset(offset).Limit(size).Find(&articles).Error
	return articles, total, err
}

func GetArticleSummaries(page, size int, tag, category, keyword string) ([]model.Article, int64, error) {
	var articles []model.Article
	var total int64

	query := db.DB.Model(&model.Article{}).Where("published = ?", true)
	if tag != "" {
		query = query.Where("FIND_IN_SET(?, REPLACE(tags, ' ', '')) > 0", tag)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR summary LIKE ? OR category LIKE ? OR tags LIKE ?", like, like, like, like)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.
		Select("id", "title", "summary", "cover_image", "category", "tags", "views", "published", "content_type", "is_locked", "requires_login", "created_at", "updated_at").
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&articles).Error
	return articles, total, err
}

func GetArticleByID(id uint64) (*model.Article, error) {
	var article model.Article
	err := db.DB.First(&article, id).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func GetArticleAccessByID(id uint64) (*model.Article, error) {
	var article model.Article
	err := db.DB.
		Select("id", "title", "summary", "cover_image", "category", "tags", "views", "published", "content_type", "static_site_key", "static_site_name", "is_locked", "requires_login", "access_password_hash", "created_at", "updated_at").
		First(&article, id).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func GetArticleContent(id uint64) (string, error) {
	var content string
	err := db.DB.Model(&model.Article{}).
		Where("id = ?", id).
		Pluck("content", &content).Error
	return content, err
}

func GetArticleCommentAccessByID(id uint64) (*model.Article, error) {
	var article model.Article
	err := db.DB.
		Select("id", "published", "content_type", "requires_login").
		First(&article, id).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func GetArticleSiteAccessByID(id uint64) (*model.Article, error) {
	var article model.Article
	err := db.DB.
		Select("id", "published", "content_type", "static_site_key", "requires_login", "updated_at").
		First(&article, id).Error
	if err != nil {
		return nil, err
	}
	return &article, nil
}

func CreateArticle(article *model.Article) error {
	return db.DB.Create(article).Error
}

func UpdateArticle(article *model.Article) error {
	return db.DB.Save(article).Error
}

func UpdateArticlesRequiresLogin(ids []uint64, required bool) (int64, error) {
	var updated int64
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		var existing []uint64
		if err := tx.Model(&model.Article{}).
			Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id IN ?", ids).
			Pluck("id", &existing).Error; err != nil {
			return err
		}
		if len(existing) != len(ids) {
			return gorm.ErrRecordNotFound
		}
		result := tx.Model(&model.Article{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"requires_login": required,
				"updated_at":     time.Now(),
			})
		updated = result.RowsAffected
		return result.Error
	})
	return updated, err
}

func DeleteArticle(id uint64) error {
	return db.DB.Delete(&model.Article{}, id).Error
}

func IncrementArticleViews(id uint64) error {
	return db.DB.Model(&model.Article{}).Where("id = ?", id).UpdateColumn("views", gorm.Expr("views + ?", 1)).Error
}

func GetAllTagsRaw() ([]string, error) {
	var tags []string
	err := db.DB.Model(&model.Article{}).Where("published = ?", true).Pluck("tags", &tags).Error
	return tags, err
}

func GetAllArticleCategories() ([]string, error) {
	var categories []string
	err := db.DB.Model(&model.Article{}).
		Where("published = ? AND category <> ?", true, "").
		Distinct().
		Order("category ASC").
		Pluck("category", &categories).Error
	return categories, err
}

func GetArticleCount() (int64, error) {
	var count int64
	err := db.DB.Model(&model.Article{}).Count(&count).Error
	return count, err
}

func GetTotalArticleViews() (int64, error) {
	var total int64
	err := db.DB.Model(&model.Article{}).Select("COALESCE(SUM(views), 0)").Scan(&total).Error
	return total, err
}

func GetReferencedArticleSiteKeys() ([]string, error) {
	var keys []string
	err := db.DB.Model(&model.Article{}).
		Where("content_type = ? AND static_site_key <> ?", "static", "").
		Pluck("static_site_key", &keys).Error
	return keys, err
}
