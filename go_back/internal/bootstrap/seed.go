package bootstrap

import (
	"errors"
	"log"
	"personal-website-go/internal/config"
	"personal-website-go/internal/model"
	"personal-website-go/internal/repository"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func SeedDefaultData() {
	log.Printf(
		"admin seed check: username=%q reset_password=%v",
		config.AppConfig.AdminUsername,
		config.AppConfig.AdminResetPassword,
	)

	existing, err := repository.GetUserByUsername(config.AppConfig.AdminUsername)
	if err == nil && existing != nil {
		if !existing.PasswordConfigured {
			existing.PasswordConfigured = true
			if err := repository.UpdateUser(existing); err != nil {
				log.Printf("failed to mark existing admin password as configured: %v", err)
				return
			}
		}
		if !config.AppConfig.AdminResetPassword {
			log.Printf("admin user %q already exists; skip default password seeding", existing.Username)
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(config.AppConfig.AdminPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("failed to hash configured admin password: %v", err)
			return
		}
		existing.Password = string(hash)
		existing.PasswordConfigured = true
		existing.Role = "ADMIN"
		if err := repository.UpdateUser(existing); err != nil {
			log.Printf("failed to reset admin password: %v", err)
			return
		}
		log.Printf("reset password for admin user %q because ADMIN_RESET_PASSWORD=true", existing.Username)
		return
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("failed to query admin user %q: %v", config.AppConfig.AdminUsername, err)
		return
	}
	if config.AppConfig.GinMode == "release" && config.IsUnsafeAdminPassword(config.AppConfig.AdminPassword) {
		log.Printf("refusing to create a new admin user %q with an unsafe configured password", config.AppConfig.AdminUsername)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(config.AppConfig.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("failed to hash default admin password: %v", err)
		return
	}

	user := &model.User{
		Username:           config.AppConfig.AdminUsername,
		Password:           string(hash),
		PasswordConfigured: true,
		Email:              config.AppConfig.AdminEmail,
		Role:               "ADMIN",
		Status:             "active",
		TokenVersion:       1,
		EmailVerified:      true,
		Nickname:           "站长",
		Bio:                "全栈开发者，热爱技术与开源。",
		Location:           "中国",
		Github:             "https://github.com",
		Tags:               "全栈开发,技术爱好者",
		WelcomeText:        "Hello, I'm",
		CtaTitle:           "Let's Work Together",
		CtaDesc:            "欢迎联系我。",
		CoffeeCount:        1000,
		StarsCount:         1000,
	}
	if err := repository.CreateUser(user); err != nil {
		log.Printf("failed to create default admin: %v", err)
		return
	}
	log.Printf("created default admin user %q; change the password after first login", user.Username)
}
