package bootstrap

import (
	"log"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

func SeedDefaultData() {
	count, err := repository.CountUsers()
	if err != nil {
		log.Printf("failed to count users: %v", err)
		return
	}
	if count > 0 {
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(config.AppConfig.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("failed to hash default admin password: %v", err)
		return
	}

	user := &model.User{
		Username:    config.AppConfig.AdminUsername,
		Password:    string(hash),
		Email:       config.AppConfig.AdminEmail,
		Role:        "ADMIN",
		Nickname:    "站长",
		Bio:         "全栈开发者，热爱技术与开源。",
		Location:    "中国",
		Github:      "https://github.com",
		Tags:        "全栈开发,技术爱好者",
		WelcomeText: "Hello, I'm",
		CtaTitle:    "Let's Work Together",
		CtaDesc:     "欢迎联系我。",
		CoffeeCount: 1000,
		StarsCount:  1000,
	}
	if err := repository.CreateUser(user); err != nil {
		log.Printf("failed to create default admin: %v", err)
		return
	}
	log.Printf("created default admin user %q; change the password after first login", user.Username)
}
