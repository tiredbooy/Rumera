package cron

import (
	"context"
	"log/slog"
)

// MeiliReindexer is the narrow surface of product.MeiliIndexer used by cron.
type MeiliReindexer interface {
	FullReindex(ctx context.Context) error
}

// MeiliReindexJob rebuilds the Meilisearch products index from Postgres.
// Registered only when MEILI_ENABLED and the client connected at boot (PH-030b).
// Does not switch storefront traffic — readiness only.
type MeiliReindexJob struct {
	indexer MeiliReindexer
}

// NewMeiliReindexJob wraps an indexer for the cron runner.
func NewMeiliReindexJob(indexer MeiliReindexer) *MeiliReindexJob {
	return &MeiliReindexJob{indexer: indexer}
}

// Run executes a full reindex. Failures are logged; the process stays up.
func (j *MeiliReindexJob) Run(ctx context.Context) {
	if j == nil || j.indexer == nil {
		slog.Warn("meili reindex job: indexer not configured")
		return
	}
	if err := j.indexer.FullReindex(ctx); err != nil {
		slog.Error("meili reindex job: failed", "err", err)
		return
	}
	slog.Info("meili reindex job: done")
}
