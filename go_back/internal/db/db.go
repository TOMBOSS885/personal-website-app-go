package db

import (
	"log"
	"personal-website-go/internal/config"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	gormConfig := &gorm.Config{}
	if config.AppConfig.GinMode == "release" {
		gormConfig.Logger = logger.Default.LogMode(logger.Error)
	} else {
		gormConfig.Logger = logger.Default.LogMode(logger.Info)
	}

	var err error
	DB, err = gorm.Open(mysql.Open(config.AppConfig.MySQLDSN), gormConfig)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("failed to get database handle: %v", err)
	}
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(20)
	log.Println("database connection established")
}
