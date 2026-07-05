package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetSkills() ([]model.Skill, error) {
	var skills []model.Skill
	err := db.DB.Order("display_order ASC").Find(&skills).Error
	return skills, err
}

func GetSkillsPage(page, size int) ([]model.Skill, int64, error) {
	var skills []model.Skill
	var total int64
	query := db.DB.Model(&model.Skill{})
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
	err := query.Order("display_order ASC").
		Offset(page * size).
		Limit(size).
		Find(&skills).Error
	return skills, total, err
}

func GetSkillCount() (int64, error) {
	var count int64
	err := db.DB.Model(&model.Skill{}).Count(&count).Error
	return count, err
}

func GetSkillByID(id uint64) (*model.Skill, error) {
	var skill model.Skill
	err := db.DB.First(&skill, id).Error
	return &skill, err
}

func CreateSkill(skill *model.Skill) error {
	return db.DB.Create(skill).Error
}

func UpdateSkill(skill *model.Skill) error {
	return db.DB.Save(skill).Error
}

func DeleteSkill(id uint64) error {
	return db.DB.Delete(&model.Skill{}, id).Error
}
