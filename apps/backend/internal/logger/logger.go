package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

func New(env, logDir string) (*zap.Logger, error) {
	if env == "development" {
		return developmentLogger()
	}
	return productionLogger(logDir)
}

func developmentLogger() (*zap.Logger, error) {
	cfg := zap.NewDevelopmentConfig()
	cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	cfg.EncoderConfig.EncodeTime = zapcore.TimeEncoderOfLayout(time.DateTime)

	log, err := cfg.Build(
		zap.AddCaller(),
		zap.AddStacktrace(zapcore.ErrorLevel),
	)
	if err != nil {
		return nil, err
	}
	return log, nil
}

func productionLogger(logDir string) (*zap.Logger, error) {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return nil, fmt.Errorf("create log dir: %w", err)
	}

	enc := productionEncoder()

	stdoutCore := zapcore.NewCore(enc, zapcore.AddSync(os.Stdout), zap.InfoLevel)
	appCore := zapcore.NewCore(enc, zapcore.AddSync(newRotatingFile(logDir, "app.log", 100)), zapcore.InfoLevel)
	errCore := zapcore.NewCore(enc, zapcore.AddSync(newRotatingFile(logDir, "error.log", 50)), zapcore.ErrorLevel)
	core := zapcore.NewTee(stdoutCore, appCore, errCore)

	return zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel)), nil
}

func productionEncoder() zapcore.Encoder {
	cfg := zap.NewProductionEncoderConfig()
	cfg.TimeKey = "ts"
	cfg.EncodeTime = zapcore.RFC3339NanoTimeEncoder
	return zapcore.NewJSONEncoder(cfg)
}

func newRotatingFile(logDir, filename string, maxMB int) *lumberjack.Logger {
	return &lumberjack.Logger{
		Filename:   filepath.Join(logDir, filename),
		MaxSize:    maxMB, // megabytes
		MaxBackups: 7,     // keep last 7 rotated files
		MaxAge:     30,    // days before old files are deleted
		Compress:   true,  // gzip rotated files to save disk space
	}
}
