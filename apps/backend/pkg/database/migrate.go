package database

import (
	"database/sql"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"go.uber.org/zap"
)

func migrate(pool *pgxpool.Pool, fs embed.FS, dir string, log *zap.Logger) error {
	sqlDB := stdlib.OpenDBFromPool(pool)
	defer sqlDB.Close()

	goose.SetBaseFS(fs)
	goose.SetLogger(&gooseAdapter{log})

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	if err := goose.Up(sqlDB, dir); err != nil {
		return fmt.Errorf("goose up (%s): %w", dir, err)
	}

	return nil
}

func migrateStatus(db *sql.DB, fs embed.FS, dir string, log *zap.Logger) error {
	goose.SetBaseFS(fs)
	goose.SetLogger(&gooseAdapter{log})

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	return goose.Status(db, dir)
}

type gooseAdapter struct{ log *zap.Logger }

func (g *gooseAdapter) Fatalf(format string, v ...interface{}) {
	g.log.Sugar().Fatalf(format, v...)
}
func (g *gooseAdapter) Printf(format string, v ...interface{}) {
	g.log.Sugar().Infof(format, v...)
}
