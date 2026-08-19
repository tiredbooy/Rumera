package analytics

import (
	"context"
	"sync"
	"testing"
	"time"

	featanalytics "github.com/tiredbooy/internal/features/analytics"
)

type countingRepo struct {
	mu     sync.Mutex
	events int
	ctxErr error
}

func (r *countingRepo) InsertBatch(ctx context.Context, reqs []*featanalytics.EventReq) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if err := ctx.Err(); err != nil {
		r.ctxErr = err
		return err
	}
	r.events += len(reqs)
	return nil
}

func (r *countingRepo) Insert(context.Context, *featanalytics.EventReq) error { return nil }
func (r *countingRepo) GetByID(context.Context, string) (*featanalytics.Event, error) {
	return nil, nil
}
func (r *countingRepo) List(context.Context, featanalytics.EventFilter) ([]*featanalytics.Event, error) {
	return nil, nil
}
func (r *countingRepo) CountByType(context.Context, featanalytics.EventFilter) (featanalytics.EventBreakdown, error) {
	return nil, nil
}

// A cancelled start context is SIGTERM. Before P1-5 the workers returned on it and
// Shutdown discarded everything still buffered.
func TestQueueShutdownDrainsAfterContextCancel(t *testing.T) {
	repo := &countingRepo{}
	q := NewQueue(featanalytics.NewEventService(repo),
		WithFlushEvery(time.Hour), // only the drain may flush
		WithBatchSize(1000),
		WithWorkerCount(2),
	)

	ctx, cancel := context.WithCancel(context.Background())
	q.Start(ctx)

	const pushed = 500
	for range pushed {
		q.Push(&featanalytics.EventReq{EventType: "page_view"})
	}

	cancel()
	time.Sleep(50 * time.Millisecond) // give a ctx-honouring worker time to bail
	q.Shutdown()

	repo.mu.Lock()
	defer repo.mu.Unlock()
	if repo.ctxErr != nil {
		t.Fatalf("flush ran with a cancelled context: %v", repo.ctxErr)
	}
	if repo.events != pushed {
		t.Fatalf("drained %d of %d buffered events", repo.events, pushed)
	}
}
