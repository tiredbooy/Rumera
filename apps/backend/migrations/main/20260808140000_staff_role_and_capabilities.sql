-- +goose Up
-- Expand authorization: staff panel role + durable role→capability map.

-- +goose StatementBegin
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'vendor', 'admin', 'staff')) NOT VALID;
END $$;
-- +goose StatementEnd

ALTER TABLE users VALIDATE CONSTRAINT users_role_check;

CREATE TABLE IF NOT EXISTS role_capabilities (
    role         VARCHAR(50) PRIMARY KEY
                 CHECK (role IN ('admin', 'staff')),
    permissions  TEXT[] NOT NULL DEFAULT '{}',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin: full catalogue of frontend-aligned capability strings.
INSERT INTO role_capabilities (role, permissions, updated_at)
VALUES (
    'admin',
    ARRAY[
        'products:read', 'products:write', 'products:delete', 'tags:manage',
        'inventory:read', 'inventory:write',
        'orders:read', 'orders:write', 'orders:refund',
        'payments:read', 'coupons:manage', 'shipping:manage', 'gift-cards:issue',
        'customers:read', 'customers:write', 'customers:ban',
        'reviews:read', 'reviews:moderate',
        'recipes:read', 'recipes:write',
        'journal:read', 'journal:write',
        'hero:manage', 'analytics:read',
        'roles:manage', 'settings:manage'
    ]::TEXT[],
    NOW()
)
ON CONFLICT (role) DO NOTHING;

-- Staff: lower-privilege operator package (no roles/settings/delete/ban/refund).
INSERT INTO role_capabilities (role, permissions, updated_at)
VALUES (
    'staff',
    ARRAY[
        'products:read', 'products:write', 'tags:manage',
        'inventory:read', 'inventory:write',
        'orders:read', 'orders:write',
        'payments:read', 'coupons:manage', 'shipping:manage',
        'customers:read', 'customers:write',
        'reviews:read', 'reviews:moderate',
        'recipes:read', 'recipes:write',
        'journal:read', 'journal:write',
        'hero:manage', 'analytics:read'
    ]::TEXT[],
    NOW()
)
ON CONFLICT (role) DO NOTHING;

-- +goose Down
DROP TABLE IF EXISTS role_capabilities;

-- +goose StatementBegin
DO $$
BEGIN
    -- Refuse down-migration while staff users exist.
    IF EXISTS (SELECT 1 FROM users WHERE role = 'staff') THEN
        RAISE EXCEPTION 'cannot drop staff role while users.role=staff rows exist';
    END IF;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('customer', 'vendor', 'admin')) NOT VALID;
END $$;
-- +goose StatementEnd

ALTER TABLE users VALIDATE CONSTRAINT users_role_check;
