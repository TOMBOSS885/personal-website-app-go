package repository

import (
	"gorm.io/gorm"
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
		query = query.Where("tags LIKE ?", "%"+tag+"%")
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.Order("created_at DESC").Offset(offset).Limit(size).Find(&articles).Error
	return articles, total, err
}

func GetArticleSummaries(page, size int, tag string) ([]model.Article, int64, error) {
	var articles []model.Article
	var total int64

	query := db.DB.Model(&model.Article{}).Where("published = ?", true)
	if tag != "" {
		query = query.Where("tags LIKE ?", "%"+tag+"%")
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err := query.
		Select("id", "title", "summary", "cover_image", "category", "tags", "views", "published", "created_at", "updated_at").
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

func CreateArticle(article *model.Article) error {
	return db.DB.Create(article).Error
}

func UpdateArticle(article *model.Article) error {
	return db.DB.Save(article).Error
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

func GetArticleCount() (int64, error) {
	var count int64
	err := db.DB.Model(&model.Article{}).Count(&count).Error
	return count, err
}
