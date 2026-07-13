package db

import (
	"database/sql"
	"fmt"
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

	retries := config.AppConfig.DBConnectRetries
	if retries <= 0 {
		retries = 1
	}
	retryDelay := time.Duration(config.AppConfig.DBConnectRetryDelay) * time.Second
	if retryDelay <= 0 {
		retryDelay = 3 * time.Second
	}

	var sqlDB *sql.DB
	var err error
	for attempt := 1; attempt <= retries; attempt++ {
		DB, sqlDB, err = openDatabase(gormConfig)
		if err == nil {
			configurePool(sqlDB)
			log.Println("database connection established")
			return
		}
		if attempt < retries {
			log.Printf("database connection attempt %d/%d failed: %v; retrying in %s", attempt, retries, err, retryDelay)
			time.Sleep(retryDelay)
		}
	}
	log.Fatalf("failed to connect to database after %d attempt(s): %v", retries, err)
}

func openDatabase(gormConfig *gorm.Config) (*gorm.DB, *sql.DB, error) {
	gormDB, err := gorm.Open(mysql.Open(config.AppConfig.MySQLDSN), gormConfig)
	if err != nil {
		return nil, nil, err
	}
	sqlDB, err := gormDB.DB()
	if err != nil {
		return nil, nil, err
	}
	if err := sqlDB.Ping(); err != nil {
		_ = sqlDB.Close()
		return nil, nil, fmt.Errorf("database ping failed: %w", err)
	}
	return gormDB, sqlDB, nil
}

func configurePool(sqlDB *sql.DB) {
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
}

func Close() error {
	if DB == nil {
		return nil
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
