package repository

import (
	"personal-website-go/internal/db"
	"personal-website-go/internal/model"
)

func GetUserByUsername(username string) (*model.User, error) {
	var user model.User
	err := db.DB.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CountUsers() (int64, error) {
	var count int64
	err := db.DB.Model(&model.User{}).Count(&count).Error
	return count, err
}

func CreateUser(user *model.User) error {
	return db.DB.Create(user).Error
}

func GetFirstUser() (*model.User, error) {
	var user model.User
	err := db.DB.First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func UpdateUser(user *model.User) error {
	return db.DB.Save(user).Error
}
