package repository

import (
	"errors"
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	UploadAssetArticleImage    = "article_image"
	UploadAssetThemeBackground = "theme_background"
)

func UpsertUploadAsset(asset *model.UploadAsset) error {
	if asset == nil || strings.TrimSpace(asset.Kind) == "" || strings.TrimSpace(asset.URL) == "" {
		return nil
	}
	return db.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "url"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"kind", "name", "path", "size", "group_key", "variant",
		}),
	}).Create(asset).Error
}

func ListUploadAssets(kind string, page, size int) ([]model.UploadAsset, int64, error) {
	var assets []model.UploadAsset
	var total int64
	query := db.DB.Model(&model.UploadAsset{}).Where("kind = ?", strings.TrimSpace(kind))
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 0 {
		page = 0
	}
	if size <= 0 {
		size = 30
	}
	if size > 200 {
		size = 200
	}
	err := query.Order("created_at DESC, id DESC").Offset(page * size).Limit(size).Find(&assets).Error
	return assets, total, err
}

func CountUploadAssets(kind string) (int64, error) {
	var total int64
	err := db.DB.Model(&model.UploadAsset{}).Where("kind = ?", strings.TrimSpace(kind)).Count(&total).Error
	return total, err
}

func DeleteUploadAssetByURL(url string) error {
	err := db.DB.Where("url = ?", strings.TrimSpace(url)).Delete(&model.UploadAsset{}).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	return err
}

func DeleteUploadAssetsByGroup(kind, groupKey string) error {
	if strings.TrimSpace(groupKey) == "" {
		return nil
	}
	return db.DB.Where("kind = ? AND group_key = ?", strings.TrimSpace(kind), strings.TrimSpace(groupKey)).
		Delete(&model.UploadAsset{}).Error
}
