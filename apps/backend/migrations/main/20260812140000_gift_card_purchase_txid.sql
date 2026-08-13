-- +goose Up
-- PH-042a: link customer-purchased gift cards to gateway payment transaction_id
-- for idempotent issuance after webhook Confirm.
ALTER TABLE gift_cards
    ADD COLUMN IF NOT EXISTS purchase_txid VARCHAR(250);

-- Partial unique: staff-issued cards keep NULL purchase_txid (many rows).
CREATE UNIQUE INDEX IF NOT EXISTS uq_gift_cards_purchase_txid
    ON gift_cards (purchase_txid)
    WHERE purchase_txid IS NOT NULL;

COMMENT ON COLUMN gift_cards.purchase_txid IS
    'Gateway payment_transactions.transaction_id for customer purchase (PH-042a); NULL for staff issue';

-- +goose Down
DROP INDEX IF EXISTS uq_gift_cards_purchase_txid;
ALTER TABLE gift_cards DROP COLUMN IF EXISTS purchase_txid;
