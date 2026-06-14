-- +goose Up

-- Dynamic, admin-managed hero slides power the storefront's home carousel. Each
-- row is one editorial slide; the public API serves only active rows within an
-- optional scheduling window, ordered by sort_order.
CREATE TABLE IF NOT EXISTS hero_slides (
    id BIGSERIAL PRIMARY KEY,

    -- Editorial copy
    eyebrow  VARCHAR(120),                 -- small kicker above the title
    title    VARCHAR(255) NOT NULL,        -- main heading
    subtitle TEXT,                          -- supporting paragraph
    badge    VARCHAR(120),                  -- optional corner badge

    -- Imagery. image_url is the desktop/landscape asset; mobile_image_url is an
    -- optional portrait crop. See the frontend image-size spec for dimensions.
    image_url        TEXT NOT NULL,
    mobile_image_url TEXT,
    image_alt        VARCHAR(255),

    -- Calls to action
    cta_label           VARCHAR(120),
    cta_href            VARCHAR(255),
    secondary_cta_label VARCHAR(120),
    secondary_cta_href  VARCHAR(255),

    -- Presentation: text contrast theme over the image ('light' = light text).
    theme VARCHAR(20) NOT NULL DEFAULT 'dark'
        CHECK (theme IN ('light', 'dark')),

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,

    -- Optional scheduling window. NULL bounds mean "always".
    starts_at TIMESTAMPTZ,
    ends_at   TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read path: active slides ordered by sort_order. Partial index keeps the
-- common query lean.
CREATE INDEX idx_hero_slides_active
ON hero_slides (sort_order ASC, id ASC)
WHERE is_active;

CREATE TRIGGER trg_hero_slides_updated_at
BEFORE UPDATE ON hero_slides
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Seed a few default slides so the storefront renders content out of the box.
-- The images are documented placeholder paths; drop real assets at these paths
-- (see apps/frontend/public/images/hero) or edit the slides from the admin panel.
INSERT INTO hero_slides
    (eyebrow, title, subtitle, badge, image_url, image_alt, cta_label, cta_href, secondary_cta_label, secondary_cta_href, theme, sort_order)
VALUES
    ('فروشگاه منتخب رومرا',
     'هر سلیقه، یک انتخاب درست',
     'از نوشیدنی‌های دست‌چین تا لوازم خانه و آشپزخانه — مجموعه‌ای گسترده، با تضمین اصالت و ارسالی مطمئن به سراسر کشور.',
     'تازه رسیده‌ها',
     '/images/hero/slide-1.jpg', 'مجموعه منتخب رومرا',
     'مشاهده فروشگاه', '/products',
     'دسته‌بندی‌ها', '/categories',
     'dark', 1),

    ('پیشنهاد ویژه هفته',
     'برندهای محبوب، با بهترین قیمت',
     'برندهای شناخته‌شده جهانی را با قیمت ویژه اعضا و ارسال سریع تجربه کنید.',
     'تا ۳۰٪ تخفیف',
     '/images/hero/slide-2.jpg', 'پیشنهاد ویژه برندها',
     'دیدن پیشنهادها', '/products?sort=discount',
     NULL, NULL,
     'dark', 2),

    ('الهام برای هر لحظه',
     'دستورها و ایده‌هایی که کنارتان می‌مانند',
     'از کوکتل‌های خانگی تا میزبانی بی‌نقص؛ راهنماها و دستورهای رومرا را کشف کنید.',
     NULL,
     '/images/hero/slide-3.jpg', 'دستورها و ایده‌های رومرا',
     'کاوش دستورها', '/recipes',
     'خواندن ژورنال', '/journal',
     'dark', 3);

-- +goose Down

DROP TABLE IF EXISTS hero_slides;
