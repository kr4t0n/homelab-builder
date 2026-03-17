package seeds

import (
	"embed"
	"log"

	"gorm.io/gorm"
)

//go:embed sql/*.sql
var seedFS embed.FS

type seedEntry struct {
	table string
	file  string
}

var seeds = []seedEntry{
	{table: "services", file: "sql/services.sql"},
	{table: "hardware_components", file: "sql/hardware.sql"},
}

func Run(db *gorm.DB) {
	for _, s := range seeds {
		var count int64
		if err := db.Table(s.table).Count(&count).Error; err != nil {
			log.Printf("Seeds: skipping %s (table not ready: %v)", s.table, err)
			continue
		}
		if count > 0 {
			log.Printf("Seeds: %s already has %d rows, skipping", s.table, count)
			continue
		}

		data, err := seedFS.ReadFile(s.file)
		if err != nil {
			log.Printf("Seeds: failed to read %s: %v", s.file, err)
			continue
		}

		if err := db.Exec(string(data)).Error; err != nil {
			log.Printf("Seeds: failed to seed %s: %v", s.table, err)
		} else {
			log.Printf("Seeds: seeded %s successfully", s.table)
		}
	}
}
