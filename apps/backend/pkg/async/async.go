// Package async runs detached work safely outside the Gin request lifecycle.
//
// Raw `go func()` after a handler returns is not covered by Gin Recovery.
// A panic in OTP/SMS, order email, blog read counters, etc. would otherwise
// kill the whole API process. Prefer async.Go / async.GoCtx for that work.
package async

import (
	"context"
	"fmt"
	"runtime/debug"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
)

// logger is process-wide; default Nop so unit tests need no setup.
// Call SetLogger once at process boot (bootstrap) for production visibility.
var logger atomic.Pointer[zap.Logger]

func init() {
	nop := zap.NewNop()
	logger.Store(nop)
}

// SetLogger installs the process logger used when a detached task panics.
// Safe to call once at startup; nil is ignored.
func SetLogger(l *zap.Logger) {
	if l == nil {
		return
	}
	logger.Store(l)
}

func log() *zap.Logger {
	if l := logger.Load(); l != nil {
		return l
	}
	return zap.NewNop()
}

// Go runs fn in a new goroutine. Panics are recovered and logged; they never
// propagate to the process. name is a short stable label for logs (e.g. "otp.sms").
func Go(name string, fn func()) {
	if fn == nil {
		return
	}
	go func() {
		defer recoverTask(name)
		fn()
	}()
}

// GoCtx runs fn with a background context that is cancelled after timeout.
// Use for side effects that must not block the HTTP response (email, SMS, counters).
func GoCtx(name string, timeout time.Duration, fn func(ctx context.Context)) {
	if fn == nil {
		return
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	Go(name, func() {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		fn(ctx)
	})
}

func recoverTask(name string) {
	r := recover()
	if r == nil {
		return
	}
	log().Error("async task panicked",
		zap.String("task", name),
		zap.String("panic", panicString(r)),
		zap.ByteString("stack", debug.Stack()),
	)
}

func panicString(r any) string {
	switch v := r.(type) {
	case string:
		return v
	case error:
		return v.Error()
	default:
		return fmt.Sprint(v)
	}
}
