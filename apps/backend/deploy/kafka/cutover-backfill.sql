-- K-10 — run IMMEDIATELY BEFORE flipping EVENTS_BUS=postgres → kafka.
--
-- Deliberately NOT a goose migration. A migration runs at deploy time, which is
-- the wrong moment: every fact fanned out between the deploy and the flip would
-- be left unmarked and republished anyway. This has to run in the minutes before
-- the flip, by hand, as part of the runbook.
--
--   psql "$DATABASE_URL" -f deploy/kafka/cutover-backfill.sql
--
-- WHY
-- Nothing sets published_at on the Postgres bus — MarkPublished is only reached
-- from the relay loop (internal/events/worker.go RelayOnce), and the relay is
-- only spawned when EVENTS_BUS=kafka. So on the day of the flip every fact ever
-- written still has published_at IS NULL, and the newly started relay would
-- publish up to EVENTS_RETENTION (720h / 30 days) of already-consumed history in
-- one burst.
--
-- Nothing would double-run: consumers are idempotent and each already holds a
-- settled domain_event_consumptions row. The damage is a thundering herd at a
-- broker that has never carried load, with live order.paid side effects queued
-- behind 30 days of replay.
--
-- WHAT IT MARKS
-- Only facts that the Postgres path has already fanned out (dispatched_at IS NOT
-- NULL). A fact with dispatched_at IS NULL has NOT been delivered to anyone yet
-- and must still go out after the flip — marking those would silently drop
-- receipts, loyalty awards and recs signals. That is the load-bearing half of
-- the predicate.

BEGIN;

-- Look before you write. Expect the "already delivered" count to be large and
-- the "still undelivered" count to be small; if the second number is not small,
-- consumers are behind and the flip should wait rather than race them.
SELECT
    count(*) FILTER (WHERE published_at IS NULL AND dispatched_at IS NOT NULL)
        AS will_mark_published,
    count(*) FILTER (WHERE published_at IS NULL AND dispatched_at IS NULL)
        AS left_for_the_relay,
    count(*) FILTER (WHERE published_at IS NOT NULL)
        AS already_published
FROM domain_events;

UPDATE domain_events
SET published_at = NOW()
WHERE published_at IS NULL
  AND dispatched_at IS NOT NULL;

-- Should now be 0. Anything left here is a fact the relay will publish on flip.
SELECT count(*) AS unpublished_after_backfill
FROM domain_events
WHERE published_at IS NULL
  AND dispatched_at IS NOT NULL;

COMMIT;
