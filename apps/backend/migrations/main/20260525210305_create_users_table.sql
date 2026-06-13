-- +goose Up
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    user_id UUID NOT NULL,

    first_name VARCHAR(100),
    last_name VARCHAR(100),

    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),

    phone VARCHAR(20),
    national_code VARCHAR(20) UNIQUE,

    birth_date DATE,

    gender VARCHAR(20),

    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),

    role VARCHAR(50) NOT NULL DEFAULT 'customer',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    
    is_banned BOOLEAN DEFAULT FALSE,
    banned_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_oauth_unique
    UNIQUE (oauth_provider, oauth_id)
);


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS users;
