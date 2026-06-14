package database

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

var fastPolicy = Policy{MaxAttempts: 3, BaseBackoff: time.Millisecond}

func transientErr() error { return &pgconn.PgError{Code: sqlStateSerializationFailure} }
func businessErr() error  { return &pgconn.PgError{Code: "23505"} } // unique_violation

func TestWithRetryPolicy_RetriesThenSucceeds(t *testing.T) {
	calls := 0
	err := WithRetryPolicy(context.Background(), fastPolicy, func(context.Context) error {
		calls++
		if calls < 3 {
			return transientErr() // fail twice…
		}
		return nil // …then succeed
	})
	if err != nil {
		t.Fatalf("err = %v; want nil after recovery", err)
	}
	if calls != 3 {
		t.Fatalf("calls = %d; want 3 (1 + 2 retries)", calls)
	}
}

func TestWithRetryPolicy_StopsOnBusinessError(t *testing.T) {
	calls := 0
	want := businessErr()
	err := WithRetryPolicy(context.Background(), fastPolicy, func(context.Context) error {
		calls++
		return want
	})
	if !errors.Is(err, want) {
		t.Fatalf("err = %v; want the business error unwrapped", err)
	}
	if calls != 1 {
		t.Fatalf("calls = %d; want 1 (business errors must not retry)", calls)
	}
}

func TestWithRetryPolicy_ExhaustsRetries(t *testing.T) {
	calls := 0
	err := WithRetryPolicy(context.Background(), fastPolicy, func(context.Context) error {
		calls++
		return transientErr()
	})
	if err == nil {
		t.Fatal("err = nil; want the last transient error after exhausting retries")
	}
	if calls != 3 {
		t.Fatalf("calls = %d; want 3 (MaxAttempts)", calls)
	}
}

func TestWithRetryPolicy_Disabled(t *testing.T) {
	calls := 0
	err := WithRetryPolicy(context.Background(), Policy{MaxAttempts: 1}, func(context.Context) error {
		calls++
		return transientErr()
	})
	if err == nil {
		t.Fatal("err = nil; want the error from the single attempt")
	}
	if calls != 1 {
		t.Fatalf("calls = %d; want 1 (retry disabled)", calls)
	}
}

func TestWithRetryPolicy_StopsOnCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	calls := 0
	_ = WithRetryPolicy(ctx, fastPolicy, func(context.Context) error {
		calls++
		return transientErr()
	})
	if calls > 1 {
		t.Fatalf("calls = %d; want at most 1 with a cancelled context", calls)
	}
}

func TestIsTransient(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil", nil, false},
		{"serialization 40001", &pgconn.PgError{Code: "40001"}, true},
		{"deadlock 40P01", &pgconn.PgError{Code: "40P01"}, true},
		{"unique violation 23505", &pgconn.PgError{Code: "23505"}, false},
		{"check violation 23514", &pgconn.PgError{Code: "23514"}, false},
		{"plain error", errors.New("boom"), false},
		{"wrapped serialization", errors.Join(errors.New("ctx"), &pgconn.PgError{Code: "40001"}), true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isTransient(tc.err); got != tc.want {
				t.Fatalf("isTransient(%v) = %v; want %v", tc.err, got, tc.want)
			}
		})
	}
}
