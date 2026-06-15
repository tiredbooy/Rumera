-- +goose Up
-- Phone numbers identify SMS-OTP accounts, so they must be unique. A partial
-- unique index ignores the many NULL phones (email/password accounts) while
-- guaranteeing at most one account per real phone number.
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
    ON users (phone)
    WHERE phone IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS users_phone_unique;
