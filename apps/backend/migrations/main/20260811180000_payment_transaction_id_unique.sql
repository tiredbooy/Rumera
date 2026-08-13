-- +goose NO TRANSACTION

-- +goose Up
-- PH-011d: gateway transaction_id is the business natural key for payment
-- settlement. Collapse any historical duplicates (keep best status, then
-- highest id), drop the non-unique lookup index, and add a UNIQUE index
-- CONCURRENTLY so production can apply without write locks.

-- Prefer succeeded / refunded over pending / failed when collapsing dupes.
DELETE FROM payment_transactions pt
WHERE pt.id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY transaction_id
                   ORDER BY
                       CASE status
                           WHEN 'succeeded' THEN 1
                           WHEN 'partially_refunded' THEN 2
                           WHEN 'refunded' THEN 3
                           WHEN 'pending' THEN 4
                           WHEN 'failed' THEN 5
                           ELSE 6
                       END,
                       id DESC
               ) AS rn
        FROM payment_transactions
    ) ranked
    WHERE rn > 1
);

DROP INDEX CONCURRENTLY IF EXISTS idx_payment_transactions_txid;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_payment_transactions_transaction_id
    ON payment_transactions (transaction_id);

-- +goose Down
-- Restores a non-unique index for lookups. Deleted duplicate rows are not
-- resurrected (irreversible data cleanup by design).
DROP INDEX CONCURRENTLY IF EXISTS uq_payment_transactions_transaction_id;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_txid
    ON payment_transactions (transaction_id);
