package bootstrap

import (
	"fmt"

	config "github.com/tiredbooy/configs"
	"go.uber.org/zap"
)

func newLogger(cfg *config.Config) (*zap.Logger, error) {
	var (
		logger *zap.Logger
		err    error
	)

	if cfg.IsDevelopment() {
		logger, err = zap.NewDevelopment()
	} else {
		logger, err = zap.NewProduction()
	}

	if err != nil {
		return nil, fmt.Errorf("build zap logger: %w", err)
	}

	return logger, nil
}
