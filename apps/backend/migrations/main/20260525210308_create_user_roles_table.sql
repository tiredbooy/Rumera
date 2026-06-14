-- +goose Up
CREATE TABLE IF NOT EXISTS user_roles (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- who assigned this role
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,                    -- optional: time-limited roles
    UNIQUE (user_id, role_id)
);

CREATE INDEX ON user_roles (user_id);
CREATE INDEX ON user_roles (role_id);

-- +goose Down
DROP TABLE IF EXISTS user_roles;