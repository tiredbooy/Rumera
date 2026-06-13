-- +goose Up
CREATE TABLE IF NOT EXISTS permissions (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,  -- e.g. 'orders:read'
    resource    VARCHAR(100) NOT NULL,          -- e.g. 'orders'
    action      VARCHAR(100) NOT NULL,          -- e.g. 'read', 'write', 'delete', 'ban'
    description TEXT,
    UNIQUE (resource, action)
);

CREATE INDEX ON user_roles (user_id);

-- +goose Down
DROP TABLE IF EXISTS permissions;