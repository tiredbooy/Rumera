package analytics

import (
	"context"
	"log/slog"
	"sync"
	"time"

	featanalytics "github.com/tiredbooy/internal/features/analytics"
)

const (
	defaultChannelSize = 10_000          // how many events buffer before drops
	defaultBatchSize   = 250             // flush when this many events queued
	defaultFlushEvery  = 3 * time.Second // flush even if batch not full
	defaultWorkerCount = 4               // parallel batch writers
)

type Queue struct {
	ch      chan *featanalytics.EventReq
	wg      sync.WaitGroup
	service *featanalytics.EventService

	batchSize   int
	flushEvery  time.Duration
	workerCount int
}

type QueueOption func(*Queue)

func WithBatchSize(n int) QueueOption            { return func(q *Queue) { q.batchSize = n } }
func WithFlushEvery(d time.Duration) QueueOption { return func(q *Queue) { q.flushEvery = d } }
func WithWorkerCount(n int) QueueOption          { return func(q *Queue) { q.workerCount = n } }
func WithChannelSize(n int) QueueOption {
	return func(q *Queue) { q.ch = make(chan *featanalytics.EventReq, n) }
}

func NewQueue(svc *featanalytics.EventService, opts ...QueueOption) *Queue {
	q := &Queue{
		ch:          make(chan *featanalytics.EventReq, defaultChannelSize),
		service:     svc,
		batchSize:   defaultBatchSize,
		flushEvery:  defaultFlushEvery,
		workerCount: defaultWorkerCount,
	}
	for _, opt := range opts {
		opt(q)
	}
	return q
}

// Depth returns the number of events currently buffered and awaiting flush. It is
// read by the metrics layer at scrape time; a depth approaching Capacity means the
// workers are falling behind and Push is about to start dropping events.
func (q *Queue) Depth() int { return len(q.ch) }

// Capacity returns the fixed size of the event buffer.
func (q *Queue) Capacity() int { return cap(q.ch) }

// Push is called by middleware — never blocks, drops on full channel.
func (q *Queue) Push(e *featanalytics.EventReq) {
	select {
	case q.ch <- e:
	default:
		// channel full: drop and log — never block the HTTP handler
		slog.Warn("analytics queue full, event dropped", "event_type", e.EventType)
	}
}

// Start launches worker goroutines. Call once at app startup.
func (q *Queue) Start(ctx context.Context) {
	for i := range q.workerCount {
		q.wg.Add(1)
		go q.worker(ctx, i)
	}
}

// Shutdown drains the channel and waits for all workers to finish.
// Call during graceful shutdown.
func (q *Queue) Shutdown() {
	close(q.ch)
	q.wg.Wait()
}

func (q *Queue) worker(ctx context.Context, id int) {
	defer q.wg.Done()

	batch := make([]*featanalytics.EventReq, 0, q.batchSize)
	ticker := time.NewTicker(q.flushEvery)
	defer ticker.Stop()

	flush := func() {
		if len(batch) == 0 {
			return
		}
		if err := q.service.FlushEvents(ctx, batch); err != nil {
			slog.Error("analytics flush failed", "worker", id, "count", len(batch), "err", err)
		}
		batch = batch[:0] // reset slice, reuse memory
	}

	for {
		select {
		case e, ok := <-q.ch:
			if !ok {
				// channel closed — drain and exit
				flush()
				return
			}
			batch = append(batch, e)
			if len(batch) >= q.batchSize {
				flush()
			}

		case <-ticker.C:
			flush()

		case <-ctx.Done():
			flush()
			return
		}
	}
}
