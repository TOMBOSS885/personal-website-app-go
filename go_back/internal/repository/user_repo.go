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
