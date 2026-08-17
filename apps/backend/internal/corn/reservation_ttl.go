package cron

import (
	"context"
	"log/slog"
)

// ReservationExpirer flips unpaid pending orders past the reservation TTL.
// Implemented by *orders.orderService.ExpireStaleReservations (not on the
// orders.Service interface — bootstrap type-asserts the concrete value).
type ReservationExpirer interface {
	ExpireStaleReservations(ctx context.Context) (int, error)
}

// ReservationTTLJob is the unpaid-reservation sweeper. Abandoned pending
// orders (wallet/bank_transfer often never webhook) would otherwise hold
// committed_stock forever.
type ReservationTTLJob struct {
	expirer ReservationExpirer
}

func NewReservationTTLJob(expirer ReservationExpirer) *ReservationTTLJob {
	return &ReservationTTLJob{expirer: expirer}
}

func (j *ReservationTTLJob) Run(ctx context.Context) {
	if j == nil || j.expirer == nil {
		slog.Error("reservation ttl job: expirer nil")
		return
	}
	n, err := j.expirer.ExpireStaleReservations(ctx)
	if err != nil {
		slog.Error("reservation ttl job: expire", "expired", n, "err", err)
		return
	}
	if n == 0 {
		return
	}
	slog.Info("reservation ttl job: done", "expired", n)
}
