-- +goose Up
CREATE TABLE IF NOT EXISTS recipe_tags (
    id BIGSERIAL PRIMARY KEY,

    recipe_id BIGINT NOT NULL
        REFERENCES recipes(id)
        ON DELETE CASCADE,

    tag_id BIGINT NOT NULL
        REFERENCES tags(id)
        ON DELETE CASCADE,

    UNIQUE(recipe_id, tag_id)
);

CREATE INDEX idx_recipe_tags_recipe_id
ON recipe_tags(recipe_id);

CREATE INDEX idx_recipe_tags_tag_id
ON recipe_tags(tag_id);

-- +goose Down
DROP TABLE IF EXISTS recipe_tags;
