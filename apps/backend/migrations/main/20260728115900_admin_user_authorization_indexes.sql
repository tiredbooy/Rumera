-- +goose NO TRANSACTION

-- +goose Up
-- Recreate on retry so a failed concurrent build cannot leave an invalid index
-- that a later IF NOT EXISTS would silently accept.
DROP INDEX CONCURRENTLY IF EXISTS users_user_id_unique_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_role_is_active_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_created_at_id_idx;

CREATE UNIQUE INDEX CONCURRENTLY users_user_id_unique_idx
    ON users (user_id);
CREATE INDEX CONCURRENTLY users_role_is_active_idx
    ON users (role, is_active, is_banned);
CREATE INDEX CONCURRENTLY users_created_at_id_idx
    ON users (created_at DESC, id DESC);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS users_created_at_id_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_role_is_active_idx;
DROP INDEX CONCURRENTLY IF EXISTS users_user_id_unique_idx;
