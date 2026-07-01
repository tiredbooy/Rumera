-- +goose Up
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    slug TEXT,
    image_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    card_size VARCHAR(10) NOT NULL DEFAULT 'small' CHECK (card_size IN ('large', 'small')),
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_featured ON categories (is_featured, display_order) WHERE is_featured = TRUE;

CREATE TRIGGER trg_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS categories;