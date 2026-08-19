package cron

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// statsBackfillDays is how far the daily roll-up jobs look back for days they
// still owe. Long enough to survive a weekend outage or a CRON_ENABLED=false
// window, short enough that the gap scan stays inside a few Timescale chunks.
const statsBackfillDays = 14

// pendingStatDatesSQL lists every day in the window that has events but no row in
// the roll-up table — the days the job still owes.
//
// The roll-ups are upserted from Go, not TimescaleDB continuous aggregates
// (COUNT(DISTINCT …) rules those out), so nothing recomputes a day the scheduler
// missed. Aggregating only "yesterday" meant one skipped tick — a deploy, a crash,
// a single-replica cron window — left that day permanently missing from every
// dashboard, with no error anywhere. Re-running a day is safe: FlushStats upserts.
const pendingStatDatesSQL = `
	SELECT DISTINCT (date_trunc('day', e.created_at))::date AS d
	FROM   events e
	WHERE  e.created_at >= $1
	  AND  e.created_at <  $2
	  AND  NOT EXISTS (
	         SELECT 1 FROM %s s
	         WHERE  s.date = (date_trunc('day', e.created_at))::date
	       )
	ORDER  BY d`

// statsBackfillWindow is the [from, to) the gap scan covers for a given clock
// reading: the last statsBackfillDays whole UTC days, ending with yesterday.
func statsBackfillWindow(now time.Time) (from, to time.Time) {
	to = now.UTC().Truncate(24 * time.Hour)
	return to.AddDate(0, 0, -statsBackfillDays), to
}

// pendingStatDates returns the days rollupTable is missing, oldest first.
//
// rollupTable is interpolated into the query, so it must stay a package-internal
// constant — never a value that reached us from a request.
func pendingStatDates(ctx context.Context, db *pgxpool.Pool, rollupTable string, now time.Time) ([]time.Time, error) {
	from, to := statsBackfillWindow(now)
	rows, err := db.Query(ctx, fmt.Sprintf(pendingStatDatesSQL, rollupTable), from, to)
	if err != nil {
		return nil, fmt.Errorf("pending stat dates for %s: %w", rollupTable, err)
	}
	defer rows.Close()

	var dates []time.Time
	for rows.Next() {
		var d time.Time
		if err := rows.Scan(&d); err != nil {
			return nil, fmt.Errorf("scanning pending stat date: %w", err)
		}
		dates = append(dates, d.UTC().Truncate(24*time.Hour))
	}
	return dates, rows.Err()
}
