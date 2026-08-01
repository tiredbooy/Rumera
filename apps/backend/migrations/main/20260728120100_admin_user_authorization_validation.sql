-- +goose Up
-- These validations intentionally run in a transaction after the NOT VALID
-- constraints were committed by the preceding migration. Validation takes a
-- weaker lock and permits normal reads/writes while PostgreSQL scans users.
ALTER TABLE users VALIDATE CONSTRAINT users_role_check;
ALTER TABLE users VALIDATE CONSTRAINT users_is_banned_not_null_check;

-- PostgreSQL can reuse the validated check and avoid a second table scan. The
-- ACCESS EXCLUSIVE lock for SET NOT NULL is therefore brief.
ALTER TABLE users ALTER COLUMN is_banned SET NOT NULL;
ALTER TABLE users DROP CONSTRAINT users_is_banned_not_null_check;

-- +goose Down
ALTER TABLE users ALTER COLUMN is_banned DROP NOT NULL;
ALTER TABLE users
    ADD CONSTRAINT users_is_banned_not_null_check
    CHECK (is_banned IS NOT NULL) NOT VALID;
