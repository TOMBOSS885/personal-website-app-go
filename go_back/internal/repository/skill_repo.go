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
