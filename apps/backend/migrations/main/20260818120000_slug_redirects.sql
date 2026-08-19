-- +goose Up
-- CE-7. Renaming a recipe or journal slug used to 404 every inbound link
-- (search results, shared links, backlinks). A rename now leaves a record here
-- so the retired path keeps resolving.
--
-- The target is the entity id, never the replacement slug. Renaming twice
-- (a -> b -> c) therefore rewrites nothing: both a and b still point at the
-- same row and resolve to c in one hop, so no redirect chain can form.
CREATE TABLE IF NOT EXISTS slug_redirects (
    id           BIGSERIAL PRIMARY KEY,
    content_type TEXT NOT NULL
        CHECK (content_type IN ('recipe', 'blog')),
    from_slug    TEXT NOT NULL
        CHECK (from_slug = BTRIM(from_slug) AND from_slug <> ''),
    target_id    BIGINT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One owner per retired slug per content type. Re-pointing a slug is an
    -- upsert on this constraint, and it is also the lookup index: resolving a
    -- retired slug on the 404 path of a public page is one index scan plus a
    -- primary-key join.
    CONSTRAINT slug_redirects_from_slug_unique UNIQUE (content_type, from_slug)
);

-- No FK: one target_id column serves two content tables. The lookup joins the
-- live row, so a record left behind by a deleted item resolves to nothing and
-- 404s exactly like an unknown slug.

-- +goose Down
DROP TABLE IF EXISTS slug_redirects;
