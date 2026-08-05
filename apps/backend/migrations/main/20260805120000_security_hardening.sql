-- +goose Up
-- Session kill on password change/reset: any JWT issued at-or-before this
-- timestamp is rejected by Auth / refresh after rehydration.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS sessions_invalidated_at TIMESTAMPTZ NULL;

-- Password-reset tokens are stored as SHA-256 hex digests, never plaintext.
-- Existing plaintext rows (if any) cannot be verified after deploy; they expire
-- within the normal TTL window and are cleaned by DeleteExpired.
ALTER TABLE password_resets
    RENAME COLUMN token TO token_hash;

-- Lookup is always by the full hash; keep uniqueness for unused digests.
CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_hash_uidx
    ON password_resets (token_hash);

-- +goose Down
DROP INDEX IF EXISTS password_resets_token_hash_uidx;

ALTER TABLE password_resets
    RENAME COLUMN token_hash TO token;

ALTER TABLE users
    DROP COLUMN IF EXISTS sessions_invalidated_at;
