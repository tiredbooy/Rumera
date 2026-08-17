package bootstrap

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	notifkafka "github.com/tiredbooy/internal/notifications/kafka"
	"go.uber.org/zap"
)

// K-5. A fatal reader error used to return out of Run, get logged once, and kill
// ingest for the life of the process — no metric, no health signal, no restart,
// healthcheck green. The supervisor must bring it back.
func TestSuperviseIngestRestartsAfterFatalError(t *testing.T) {
	var calls atomic.Int32
	running := make(chan struct{}, 8)

	e := &eventSubsystem{
		log:               zap.NewNop(),
		ingestBackoffBase: time.Millisecond,
	}
	e.runIngest = func(ctx context.Context) error {
		n := calls.Add(1)
		running <- struct{}{}
		if n <= 2 {
			return errors.New("kafka fetch: broken pipe")
		}
		<-ctx.Done() // healthy from the third attempt on
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); e.superviseIngest(ctx) }()

	for i := 0; i < 3; i++ {
		select {
		case <-running:
		case <-time.After(5 * time.Second):
			t.Fatalf("ingest was not restarted; only %d attempt(s) made", calls.Load())
		}
	}

	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("supervisor did not return on context cancellation")
	}
	if e.ingestUp.Load() {
		t.Error("ingestUp still true after shutdown")
	}
}

// A clean return with no shutdown requested still means ingest has stopped, so it
// must be treated as a restart rather than a graceful exit.
func TestSuperviseIngestRestartsOnCleanStop(t *testing.T) {
	var calls atomic.Int32
	e := &eventSubsystem{log: zap.NewNop(), ingestBackoffBase: time.Millisecond}
	e.runIngest = func(ctx context.Context) error {
		if calls.Add(1) == 1 {
			return nil // every reader returned, but nobody asked for a shutdown
		}
		<-ctx.Done()
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() { defer close(done); e.superviseIngest(ctx) }()

	deadline := time.After(5 * time.Second)
	for calls.Load() < 2 {
		select {
		case <-deadline:
			t.Fatal("a clean stop without shutdown was treated as graceful; ingest stayed dead")
		case <-time.After(time.Millisecond):
		}
	}
	cancel()
	<-done
}

func TestSuperviseIngestStopsOnShutdownWithoutRestarting(t *testing.T) {
	var calls atomic.Int32
	e := &eventSubsystem{log: zap.NewNop(), ingestBackoffBase: time.Millisecond}
	e.runIngest = func(ctx context.Context) error {
		calls.Add(1)
		<-ctx.Done()
		return ctx.Err()
	}

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); e.superviseIngest(ctx) }()
	time.Sleep(20 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("supervisor did not return on shutdown")
	}
	if got := calls.Load(); got != 1 {
		t.Errorf("ingest ran %d times across a shutdown; want 1 — shutdown must not look like a crash", got)
	}
}

func TestIngestStatusReportsForReadiness(t *testing.T) {
	if got := (*eventSubsystem)(nil).ingestStatus(); got != "disabled" {
		t.Errorf("nil subsystem status = %q, want disabled", got)
	}
	postgresBus := &eventSubsystem{}
	if got := postgresBus.ingestStatus(); got != "disabled" {
		t.Errorf("no consumer (postgres bus) status = %q, want disabled", got)
	}

	kafka := &eventSubsystem{consumer: &notifkafka.Consumer{}}
	if got := kafka.ingestStatus(); got != "down" {
		t.Errorf("stopped ingest status = %q, want down — this is the signal that was missing", got)
	}
	kafka.ingestUp.Store(true)
	if got := kafka.ingestStatus(); got != "up" {
		t.Errorf("running ingest status = %q, want up", got)
	}
}
