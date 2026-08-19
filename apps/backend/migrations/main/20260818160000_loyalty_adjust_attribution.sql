-- +goose Up
-- L-4: make the points ledger answer "who granted this and why".
--
-- Before this, a staff adjust wrote only `ref_id = '{idem_key}|actor={uuid}'`
-- and threw the operator's note away after echoing it back in the HTTP
-- response, so an investigator saw «تنظیم توسط پشتیبانی» and two truncated
-- UUIDs. Point minting is a money-equivalent grant (loyalty:adjust, L-8), so
-- the note and a resolvable actor now live in columns.
--
-- actor_label is a snapshot, not a join: the audit trail has to name the
-- colleague who granted the points even after that account is deactivated,
-- renamed, or has its email changed.

ALTER TABLE loyalty_transactions
    ADD COLUMN IF NOT EXISTS note          TEXT,
    ADD COLUMN IF NOT EXISTS actor_user_id UUID,
    -- TEXT, not VARCHAR(160): the sources are first_name VARCHAR(100) + ' ' +
    -- last_name VARCHAR(100) (or email), so a long staff name overflowed the
    -- cap. In the backfill that aborts the whole migration and therefore boot;
    -- at runtime it would reject the INSERT that carries the points move, so a
    -- long-named operator could not grant points at all.
    ADD COLUMN IF NOT EXISTS actor_label   TEXT;

-- Backfill, stated explicitly:
--
--   note           stays NULL on every existing row. It was never persisted;
--                  inventing one would be fabricating an audit trail.
--   actor_user_id  is recovered from the `|actor={uuid}` suffix the old ref_id
--                  encoding already carried. Rows that predate that encoding,
--                  and every automated earn path (order_paid, signup,
--                  birthday, …), stay NULL — those have no staff actor.
--   actor_label    is resolved once, here, from the users table for the rows
--                  recovered above. It is the only reconstruction in this
--                  migration and it is best-effort: an actor whose user row is
--                  gone stays NULL and reads back as the bare UUID.

UPDATE loyalty_transactions
SET actor_user_id = SUBSTRING(ref_id FROM '\|actor=([0-9a-fA-F-]{36})$')::uuid
WHERE reason = 'admin_adjust'
  AND actor_user_id IS NULL
  AND ref_id ~ '\|actor=[0-9a-fA-F-]{36}$';

UPDATE loyalty_transactions t
SET actor_label = COALESCE(
        NULLIF(BTRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''),
        u.email
    )
FROM users u
WHERE u.user_id = t.actor_user_id
  AND t.actor_label IS NULL;

-- +goose Down
ALTER TABLE loyalty_transactions
    DROP COLUMN IF EXISTS actor_label,
    DROP COLUMN IF EXISTS actor_user_id,
    DROP COLUMN IF EXISTS note;
