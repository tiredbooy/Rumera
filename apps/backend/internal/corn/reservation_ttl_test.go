package cron

import (
	"context"
	"errors"
	"testing"
)

func TestReservationTTLJob_NilJob(t *testing.T) {
	var job *ReservationTTLJob
	job.Run(context.Background())
}

func TestReservationTTLJob_NilExpirer(t *testing.T) {
	NewReservationTTLJob(nil).Run(context.Background())
}

func TestReservationTTLJob_Run(t *testing.T) {
	tests := []struct {
		name      string
		expirer   *fakeReservationExpirer
		wantCalls int
	}{
		{name: "empty batch", expirer: &fakeReservationExpirer{}, wantCalls: 1},
		{name: "expires some", expirer: &fakeReservationExpirer{n: 3}, wantCalls: 1},
		{name: "expirer error does not panic", expirer: &fakeReservationExpirer{err: errors.New("db down")}, wantCalls: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			NewReservationTTLJob(tt.expirer).Run(context.Background())
			if tt.expirer.calls != tt.wantCalls {
				t.Fatalf("calls = %d; want %d", tt.expirer.calls, tt.wantCalls)
			}
		})
	}
}

type fakeReservationExpirer struct {
	n     int
	err   error
	calls int
}

func (f *fakeReservationExpirer) ExpireStaleReservations(context.Context) (int, error) {
	f.calls++
	return f.n, f.err
}
