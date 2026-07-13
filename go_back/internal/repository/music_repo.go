package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
	"sync"
	"time"
)

type cachedMusic struct {
	value     model.Music
	expiresAt time.Time
}

var musicMetadataCache = struct {
	sync.RWMutex
	entries map[uint64]cachedMusic
}{entries: make(map[uint64]cachedMusic)}

func GetMusics() ([]model.Music, error) {
	var musics []model.Music
	err := db.DB.Model(&model.Music{}).
		Order("display_order ASC, created_at DESC").
		Find(&musics).Error
	return musics, err
}

func GetMusicsPage(page, size int) ([]model.Music, int64, error) {
	var musics []model.Music
	var total int64
	query := db.DB.Model(&model.Music{})
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 0 {
		page = 0
	}
	if size <= 0 {
		size = 20
	}
	if size > 200 {
		size = 200
	}
	err := query.Order("display_order ASC, created_at DESC").
		Offset(page * size).
		Limit(size).
		Find(&musics).Error
	return musics, total, err
}

func GetPublicMusics() ([]model.Music, error) {
	var musics []model.Music
	err := db.DB.Model(&model.Music{}).
		Where("is_public = ?", true).
		Order("display_order ASC, created_at DESC").
		Find(&musics).Error
	return musics, err
}

func GetMusicByID(id uint64) (*model.Music, error) {
	musicMetadataCache.RLock()
	entry, ok := musicMetadataCache.entries[id]
	musicMetadataCache.RUnlock()
	if ok && time.Now().Before(entry.expiresAt) {
		music := entry.value
		return &music, nil
	}
	var music model.Music
	err := db.DB.First(&music, id).Error
	if err == nil {
		cacheMusicMetadata(music)
	}
	return &music, err
}

func GetMusicsByIDs(ids []uint64) ([]model.Music, error) {
	var musics []model.Music
	err := db.DB.Where("id IN ?", ids).Find(&musics).Error
	return musics, err
}

func CreateMusic(music *model.Music) error {
	if err := db.DB.Create(music).Error; err != nil {
		return err
	}
	cacheMusicMetadata(*music)
	return nil
}

func UpdateMusic(music *model.Music) error {
	if err := db.DB.Save(music).Error; err != nil {
		return err
	}
	cacheMusicMetadata(*music)
	return nil
}

func DeleteMusic(id uint64) error {
	err := db.DB.Delete(&model.Music{}, id).Error
	forgetMusicMetadata(id)
	return err
}

func DeleteMusics(ids []uint64) error {
	err := db.DB.Where("id IN ?", ids).Delete(&model.Music{}).Error
	for _, id := range ids {
		forgetMusicMetadata(id)
	}
	return err
}

func cacheMusicMetadata(music model.Music) {
	musicMetadataCache.Lock()
	if len(musicMetadataCache.entries) >= 1000 {
		now := time.Now()
		for id, entry := range musicMetadataCache.entries {
			if !now.Before(entry.expiresAt) {
				delete(musicMetadataCache.entries, id)
			}
		}
	}
	if len(musicMetadataCache.entries) < 1000 {
		musicMetadataCache.entries[music.ID] = cachedMusic{value: music, expiresAt: time.Now().Add(30 * time.Second)}
	}
	musicMetadataCache.Unlock()
}

func forgetMusicMetadata(id uint64) {
	musicMetadataCache.Lock()
	delete(musicMetadataCache.entries, id)
	musicMetadataCache.Unlock()
}
