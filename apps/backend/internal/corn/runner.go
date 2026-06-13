package cron

import (
	"context"
	"log/slog"
	"time"

	cronlib "github.com/robfig/cron/v3"
)

type Runner struct {
	c *cronlib.Cron
}

func NewRunner() *Runner {
	return &Runner{
		c: cronlib.New(
			cronlib.WithLocation(time.UTC),
			cronlib.WithSeconds(), // enables 6-field cron expressions
			cronlib.WithChain(
				cronlib.Recover(cronlib.DefaultLogger), // panics don't kill the process
			),
		),
	}
}

func (r *Runner) Register(schedule, name string, job func(ctx context.Context)) {
	_, err := r.c.AddFunc(schedule, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		start := time.Now()
		slog.Info("cron job started", "job", name)

		job(ctx)

		slog.Info("cron job finished", "job", name, "duration", time.Since(start))
	})
	if err != nil {
		slog.Error("failed to register cron job", "job", name, "err", err)
	}
}

func (r *Runner) Start() {
	r.c.Start()
	slog.Info("cron runner started")
}

func (r *Runner) Stop() {
	ctx := r.c.Stop()
	<-ctx.Done() // wait for running jobs to finish
	slog.Info("cron runner stopped")
}
