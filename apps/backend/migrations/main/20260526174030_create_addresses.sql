-- +goose Up
CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(100), -- Home, Work, etc.

    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),

    address_line1 VARCHAR(250) NOT NULL,
    address_line2 VARCHAR(250),

    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id
ON addresses(user_id);

-- Only one default address per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default
ON addresses(user_id)
WHERE is_default = TRUE;

CREATE TRIGGER trg_addresses_updated_at
BEFORE UPDATE ON addresses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- +goose Down
DROP TABLE IF EXISTS addresses;
