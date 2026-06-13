-- +goose Up
CREATE TABLE IF NOT EXISTS blog_categories_assignments (
    id BIGSERIAL PRIMARY KEY,
    blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    blog_category_id BIGINT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS blog_categories_assignments;
