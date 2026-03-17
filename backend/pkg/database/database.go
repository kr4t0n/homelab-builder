package database

import (
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"github.com/kr4t0n/orbit/backend/internal/config"
	"github.com/kr4t0n/orbit/backend/internal/models"
	"github.com/kr4t0n/orbit/backend/internal/seeds"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector

	if cfg.DBType == "postgres" {
		dsn := fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
		)
		dialector = postgres.Open(dsn)
	} else {
		// SQLite default
		dialector = sqlite.Open(cfg.DBFile)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if cfg.DBType == "postgres" {
		log.Println("Ensuring uuid-ossp extension exists...")
		db.Exec(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
	}

	log.Printf("Running auto-migration for %s...", cfg.DBType)
	if err := db.AutoMigrate(
		&models.User{},
		&models.Service{},
		&models.ServiceRequirement{},
		&models.UserSelection{},
		&models.HardwareRecommendation{},
		&models.ShoppingList{},
		&models.ShoppingListItem{},
		&models.Event{},
		&models.Build{},
		&models.HardwareComponent{},
		&models.HardwareReview{},
		&models.Node{},
		&models.Edge{},
		&models.NodeComponent{},
		&models.ServiceInstance{},
		&models.BetaSurvey{}, // BETA_SURVEY
		&models.SteeringRule{},
		&models.CatalogComponent{},
	); err != nil {
		log.Printf("Warning: failed to auto-migrate database: %v", err)
	}

	if cfg.DBType == "postgres" {
		seeds.Run(db)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	log.Println("Database connected successfully")
	return db, nil
}
