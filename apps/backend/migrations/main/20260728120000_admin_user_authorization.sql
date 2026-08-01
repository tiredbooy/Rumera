-- +goose Up
-- users.role is the runtime authorization source. Refuse to guess how an
-- unsupported deployed role should map: operators must resolve those rows
-- explicitly before this policy constraint can be installed.
-- +goose StatementBegin
DO $$
DECLARE
    unsupported_roles TEXT;
BEGIN
    SELECT string_agg(format('%s=%s', role, member_count), ', ' ORDER BY role)
    INTO unsupported_roles
    FROM (
        SELECT role, COUNT(*) AS member_count
        FROM users
        WHERE role NOT IN ('customer', 'vendor', 'admin')
        GROUP BY role
    ) unsupported;

    IF unsupported_roles IS NOT NULL THEN
        RAISE EXCEPTION 'cannot add users_role_check; unsupported users.role values: %', unsupported_roles
            USING ERRCODE = '23514';
    END IF;
END $$;
-- +goose StatementEnd

UPDATE users
SET is_banned = (banned_at IS NOT NULL)
WHERE is_banned IS NULL;
ALTER TABLE users ALTER COLUMN is_banned SET DEFAULT false;

ALTER TABLE users
    ADD CONSTRAINT users_is_banned_not_null_check
    CHECK (is_banned IS NOT NULL) NOT VALID;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('customer', 'vendor', 'admin')) NOT VALID;

CREATE TABLE user_admin_audit_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    target_user_id UUID NOT NULL,
    action VARCHAR(32) NOT NULL,
    changed_fields TEXT[] NOT NULL DEFAULT '{}',
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_admin_audit_events_action_check
        CHECK (action IN ('user.created', 'user.updated', 'user.deactivated')),
    CONSTRAINT user_admin_audit_events_changes_object_check
        CHECK (jsonb_typeof(changes) = 'object'),
    CONSTRAINT user_admin_audit_events_actor_fkey
        FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT user_admin_audit_events_target_fkey
        FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE RESTRICT
);

CREATE INDEX user_admin_audit_target_created_idx
    ON user_admin_audit_events (target_user_id, created_at DESC, event_id DESC);
CREATE INDEX user_admin_audit_actor_created_idx
    ON user_admin_audit_events (actor_user_id, created_at DESC, event_id DESC);

-- +goose Down
DROP TABLE IF EXISTS user_admin_audit_events;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_is_banned_not_null_check;
