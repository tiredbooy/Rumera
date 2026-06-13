-- +goose Up
CREATE TABLE review_votes (
    id BIGSERIAL PRIMARY KEY,

    review_id BIGINT NOT NULL
        REFERENCES reviews(id)
        ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    vote_type VARCHAR(20) NOT NULL
        CHECK (vote_type IN ('like', 'dislike')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(review_id, user_id)
);

-- +goose Down
DROP TABLE IF EXISTS review_votes;