-- +goose Up

-- Read accounting is operational data, not an editorial change. Limit the
-- timestamp trigger to fields that alter the post itself so total_reads updates
-- do not reorder the admin's "last edited" view.
DROP TRIGGER IF EXISTS trg_blogs_updated_at ON blogs;

CREATE TRIGGER trg_blogs_updated_at
BEFORE UPDATE OF
    author_id,
    title,
    slug,
    content,
    excerpt,
    image_url,
    image_storage_key,
    image_alt,
    time_to_read,
    status,
    is_featured,
    meta_title,
    meta_description,
    published_at,
    deleted_at
ON blogs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- +goose Down

DROP TRIGGER IF EXISTS trg_blogs_updated_at ON blogs;

CREATE TRIGGER trg_blogs_updated_at
BEFORE UPDATE ON blogs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
