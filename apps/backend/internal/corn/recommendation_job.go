package cron

import (
	"context"
	"log/slog"
	"time"

	"github.com/tiredbooy/internal/services"
)

// RecommendationRefreshJob rebuilds affinity profiles for recently-active users
// on a schedule. Pre-warming profiles keeps GET /recommendations/for-you off the
// compute path: the request reads a ready-made profile instead of aggregating a
// user's whole interaction + order history inline.
type RecommendationRefreshJob struct {
	svc        services.RecommendationService
	windowDays int
	maxUsers   int
}

func NewRecommendationRefreshJob(svc services.RecommendationService, windowDays, maxUsers int) *RecommendationRefreshJob {
	return &RecommendationRefreshJob{svc: svc, windowDays: windowDays, maxUsers: maxUsers}
}

func (j *RecommendationRefreshJob) Run(ctx context.Context) {
	start := time.Now()
	slog.Info("recommendation refresh job: starting",
		"window_days", j.windowDays, "max_users", j.maxUsers)

	refreshed, err := j.svc.RefreshActiveProfiles(ctx, j.windowDays, j.maxUsers)
	if err != nil {
		// A partial failure still refreshed `refreshed` users; report both.
		slog.Error("recommendation refresh job: finished with error",
			"refreshed", refreshed, "err", err, "duration", time.Since(start))
		return
	}

	slog.Info("recommendation refresh job: done",
		"refreshed", refreshed, "duration", time.Since(start))
}
