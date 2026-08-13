package cron

import (
	"context"
	"log/slog"
	"time"
)

// BirthdayRunner awards yearly loyalty birthday points (PH-040b).
type BirthdayRunner interface {
	RunBirthdayAwards(ctx context.Context, now time.Time) (granted int, err error)
}

// LoyaltyBirthdayJob runs daily (UTC schedule; awards use programme TZ).
type LoyaltyBirthdayJob struct {
	runner BirthdayRunner
}

// NewLoyaltyBirthdayJob wraps loyalty.Service.RunBirthdayAwards.
func NewLoyaltyBirthdayJob(runner BirthdayRunner) *LoyaltyBirthdayJob {
	return &LoyaltyBirthdayJob{runner: runner}
}

// Run executes birthday awards for "now".
func (j *LoyaltyBirthdayJob) Run(ctx context.Context) {
	if j == nil || j.runner == nil {
		slog.Warn("loyalty birthday job: runner not configured")
		return
	}
	granted, err := j.runner.RunBirthdayAwards(ctx, time.Now())
	if err != nil {
		slog.Error("loyalty birthday job: failed", "err", err)
		return
	}
	slog.Info("loyalty birthday job: done", "granted", granted)
}
