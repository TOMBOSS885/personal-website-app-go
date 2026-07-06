package repository

import (
	"errors"
	"os"
	"path/filepath"
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
	_, _ = CleanupMissingUploadAssets(kind)

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

func CleanupMissingUploadAssets(kind string) (int64, error) {
	var assets []model.UploadAsset
	query := db.DB.Model(&model.UploadAsset{})
	if kind = strings.TrimSpace(kind); kind != "" {
		query = query.Where("kind = ?", kind)
	}
	if err := query.Find(&assets).Error; err != nil {
		return 0, err
	}

	var missingIDs []uint64
	for _, asset := range assets {
		if uploadAssetExists(asset) {
			continue
		}
		missingIDs = append(missingIDs, asset.ID)
	}
	if len(missingIDs) == 0 {
		return 0, nil
	}
	if err := db.DB.Where("id IN ?", missingIDs).Delete(&model.UploadAsset{}).Error; err != nil {
		return 0, err
	}
	return int64(len(missingIDs)), nil
}

func uploadAssetExists(asset model.UploadAsset) bool {
	path := strings.TrimSpace(asset.Path)
	if path == "" {
		return false
	}
	if !filepath.IsAbs(path) {
		abs, err := filepath.Abs(path)
		if err == nil {
			path = abs
		}
	}
	info, err := os.Stat(path)
	if err == nil {
		return !info.IsDir()
	}
	return !errors.Is(err, os.ErrNotExist)
}
