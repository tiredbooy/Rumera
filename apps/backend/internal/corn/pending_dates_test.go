package cron

import (
	"strings"
	"testing"
	"time"
)

func TestStatsBackfillWindowEndsYesterday(t *testing.T) {
	now := time.Date(2026, 8, 18, 3, 30, 0, 0, time.UTC)
	from, to := statsBackfillWindow(now)

	// `to` is exclusive and lands on midnight today, so the newest whole day the
	// scan can return is yesterday — today is still accumulating events.
	if !to.Equal(time.Date(2026, 8, 18, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("to = %s; want midnight today", to)
	}
	if !from.Equal(time.Date(2026, 8, 4, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("from = %s; want %d whole days back", from, statsBackfillDays)
	}
	if got := to.Sub(from); got != statsBackfillDays*24*time.Hour {
		t.Fatalf("window = %s; want %d days", got, statsBackfillDays)
	}
}

func TestStatsBackfillWindowIgnoresClockPosition(t *testing.T) {
	// The roll-up runs on a cron schedule; the window must not shift with the
	// minute it happens to fire, or a re-run would aggregate a partial day.
	early, _ := statsBackfillWindow(time.Date(2026, 8, 18, 0, 0, 1, 0, time.UTC))
	late, _ := statsBackfillWindow(time.Date(2026, 8, 18, 23, 59, 59, 0, time.UTC))
	if !early.Equal(late) {
		t.Fatalf("window moved within the day: %s vs %s", early, late)
	}
}

// The gap scan is the whole point: a day with events and no roll-up row must come
// back. Without the NOT EXISTS it degenerates to "every day in the window", and
// without the events join it can never notice a missed tick at all.
func TestPendingStatDatesSQLDetectsGaps(t *testing.T) {
	q := strings.Join(strings.Fields(strings.ToLower(pendingStatDatesSQL)), " ")

	for _, want := range []string{
		"from events e", // days that have data…
		"not exists",    // …but no roll-up row
		"s.date = (date_trunc('day', e.created_at))::date",
		"e.created_at >= $1", // bounded by the backfill window
		"e.created_at < $2",
		"order by d", // oldest first, so a backfill runs forward
	} {
		if !strings.Contains(q, strings.ToLower(want)) {
			t.Fatalf("gap scan lost %q:\n%s", want, pendingStatDatesSQL)
		}
	}
	if !strings.Contains(pendingStatDatesSQL, "%s") {
		t.Fatal("gap scan must take the roll-up table name")
	}
}
