package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetProjects(featuredOnly bool) ([]model.Project, error) {
	var projects []model.Project
	query := db.DB.Model(&model.Project{})
	if featuredOnly {
		query = query.Where("featured = ?", true)
	}
	err := query.Order("display_order ASC").Find(&projects).Error
	return projects, err
}

func GetProjectCount() (int64, error) {
	var count int64
	err := db.DB.Model(&model.Project{}).Count(&count).Error
	return count, err
}

func GetTotalStars() (int64, error) {
	var total int64
	db.DB.Model(&model.Project{}).Select("SUM(stars)").Scan(&total)
	return total, nil
}

func CreateProject(project *model.Project) error {
	return db.DB.Create(project).Error
}

func UpdateProject(project *model.Project) error {
	return db.DB.Save(project).Error
}

func DeleteProject(id uint64) error {
	return db.DB.Delete(&model.Project{}, id).Error
}

func GetProjectByID(id uint64) (*model.Project, error) {
	var project model.Project
	err := db.DB.First(&project, id).Error
	return &project, err
}
