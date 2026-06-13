-- +goose Up
CREATE TABLE IF NOT EXISTS recipes (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    content TEXT NOT NULL,
    difficulty VARCHAR(20) NOT NULL
        CHECK (
            difficulty IN (
                'easy',
                'medium',
                'hard'
            )
        ),
    prep_time_minutes INTEGER NOT NULL DEFAULT 0
        CHECK (prep_time_minutes >= 0),
    cook_time_minutes INTEGER NOT NULL DEFAULT 0
        CHECK (cook_time_minutes >= 0),
    servings INTEGER NOT NULL DEFAULT 1
        CHECK (servings > 0),
    image_url TEXT,
    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipes_user_id
ON recipes(user_id);

CREATE INDEX idx_recipes_slug
ON recipes(slug);

CREATE TRIGGER trg_recipes_updated_at
BEFORE UPDATE ON recipes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down
DROP TABLE IF EXISTS recipes;
