package async

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"
)

func TestGoRecoversPanic(t *testing.T) {
	// Serial: mutates process logger.
	core, recorded := observer.New(zapcore.ErrorLevel)
	SetLogger(zap.New(core))
	t.Cleanup(func() { SetLogger(zap.NewNop()) })

	done := make(chan struct{})
	Go("test.panic", func() {
		defer close(done)
		panic("boom")
	})
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for Go")
	}
	// recoverTask runs after the panicking fn's defers — brief wait for log.
	deadline := time.Now().Add(2 * time.Second)
	for recorded.Len() == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if recorded.Len() == 0 {
		t.Fatal("expected panic to be logged")
	}
	entry := recorded.All()[0]
	if entry.Message != "async task panicked" {
		t.Fatalf("log message = %q", entry.Message)
	}
	if got := entry.ContextMap()["task"]; got != "test.panic" {
		t.Fatalf("task field = %v", got)
	}
}

func TestGoRunsFn(t *testing.T) {
	t.Parallel()

	var ran atomic.Bool
	var wg sync.WaitGroup
	wg.Add(1)
	Go("test.run", func() {
		defer wg.Done()
		ran.Store(true)
	})
	wg.Wait()
	if !ran.Load() {
		t.Fatal("fn did not run")
	}
}

func TestGoNilFnNoop(t *testing.T) {
	t.Parallel()
	// Must not panic.
	Go("test.nil", nil)
}

func TestGoCtxTimeout(t *testing.T) {
	t.Parallel()

	var wg sync.WaitGroup
	wg.Add(1)
	var sawDeadline atomic.Bool
	GoCtx("test.ctx", 30*time.Millisecond, func(ctx context.Context) {
		defer wg.Done()
		<-ctx.Done()
		if ctx.Err() != nil {
			sawDeadline.Store(true)
		}
	})
	wg.Wait()
	if !sawDeadline.Load() {
		t.Fatal("expected context deadline")
	}
}

func TestGoCtxRecoversPanic(t *testing.T) {
	// Serial: mutates process logger.
	core, recorded := observer.New(zapcore.ErrorLevel)
	SetLogger(zap.New(core))
	t.Cleanup(func() { SetLogger(zap.NewNop()) })

	done := make(chan struct{})
	GoCtx("test.ctx.panic", time.Second, func(ctx context.Context) {
		defer close(done)
		panic("ctx-boom")
	})
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout waiting for GoCtx")
	}
	deadline := time.Now().Add(2 * time.Second)
	for recorded.Len() == 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if recorded.Len() == 0 {
		t.Fatal("expected panic log")
	}
}
