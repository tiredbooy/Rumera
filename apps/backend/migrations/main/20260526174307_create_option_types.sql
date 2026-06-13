-- +goose Up
CREATE TABLE IF NOT EXISTS option_types (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(80),
    display_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), 
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW() 
);

CREATE TRIGGER trg_option_types_updated_at
BEFORE UPDATE ON option_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS option_types;
