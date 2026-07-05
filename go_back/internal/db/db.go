package db

import (
	"log"
	"personal-website-go/internal/config"
	"time"

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
	maxIdle := config.AppConfig.DBMaxIdleConns
	if maxIdle <= 0 {
		maxIdle = 10
	}
	maxOpen := config.AppConfig.DBMaxOpenConns
	if maxOpen <= 0 {
		maxOpen = 50
	}
	lifetimeMinutes := config.AppConfig.DBConnMaxLifetimeMin
	if lifetimeMinutes <= 0 {
		lifetimeMinutes = 55
	}
	sqlDB.SetMaxIdleConns(maxIdle)
	sqlDB.SetMaxOpenConns(maxOpen)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)
	sqlDB.SetConnMaxLifetime(time.Duration(lifetimeMinutes) * time.Minute)
	log.Println("database connection established")
}
