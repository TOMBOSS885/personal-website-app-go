package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetMusics() ([]model.Music, error) {
	var musics []model.Music
	err := db.DB.Model(&model.Music{}).
		Order("display_order ASC, created_at DESC").
		Find(&musics).Error
	return musics, err
}

func GetMusicByID(id uint64) (*model.Music, error) {
	var music model.Music
	err := db.DB.First(&music, id).Error
	return &music, err
}

func GetMusicsByIDs(ids []uint64) ([]model.Music, error) {
	var musics []model.Music
	err := db.DB.Where("id IN ?", ids).Find(&musics).Error
	return musics, err
}

func CreateMusic(music *model.Music) error {
	return db.DB.Create(music).Error
}

func UpdateMusic(music *model.Music) error {
	return db.DB.Save(music).Error
}

func DeleteMusic(id uint64) error {
	return db.DB.Delete(&model.Music{}, id).Error
}

func DeleteMusics(ids []uint64) error {
	return db.DB.Where("id IN ?", ids).Delete(&model.Music{}).Error
}
