-- +goose Up

-- Site settings is a single-row configuration document for the storefront. The
-- admin manages the store profile, contact info, social links, shipping note,
-- SEO/meta defaults and maintenance mode from one place. Rather than a wide
-- column-per-field schema (which would need a migration for every new knob), the
-- typed groups live in a JSONB document so the shape can evolve without DDL.
--
-- The table is constrained to exactly one row (id = 1) — there is only ever one
-- site. Reads target that row; writes upsert it.
CREATE TABLE IF NOT EXISTS site_settings (
    -- Singleton guard: only id = 1 is allowed, so the table can hold at most one
    -- configuration row.
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),

    -- The full settings document. Typed groups (store, contact, social,
    -- shipping, seo, maintenance) are nested objects inside this JSONB blob.
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_site_settings_updated_at
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Seed the singleton row with sensible defaults so the storefront and admin
-- render content out of the box. Edit these from the admin settings panel.
INSERT INTO site_settings (id, settings)
VALUES (
    1,
    jsonb_build_object(
        'store', jsonb_build_object(
            'name', 'رومرا',
            'tagline', 'هر سلیقه، یک انتخاب درست',
            'logoUrl', '/images/logo.svg',
            'description', 'فروشگاه اینترنتی رومرا — مجموعه‌ای گسترده با تضمین اصالت و ارسال مطمئن به سراسر کشور.'
        ),
        'contact', jsonb_build_object(
            'supportEmail', 'support@rumera.example',
            'supportPhone', '021-00000000',
            'address', 'تهران، ایران',
            'workingHours', 'شنبه تا پنجشنبه، ۹ تا ۱۸'
        ),
        'social', jsonb_build_object(
            'instagram', '',
            'telegram', '',
            'whatsapp', '',
            'twitter', '',
            'youtube', '',
            'linkedin', ''
        ),
        'shipping', jsonb_build_object(
            'freeThreshold', 5000000,
            'note', 'ارسال رایگان برای سفارش‌های بالای مبلغ تعیین‌شده.'
        ),
        'seo', jsonb_build_object(
            'defaultTitle', 'رومرا | فروشگاه اینترنتی',
            'defaultDescription', 'خرید آنلاین از رومرا با تضمین اصالت کالا و ارسال سریع.',
            'ogImage', '/images/og-default.jpg',
            'keywords', ''
        ),
        'maintenance', jsonb_build_object(
            'enabled', false,
            'message', 'سایت در حال به‌روزرسانی است. به‌زودی برمی‌گردیم.'
        )
    )
)
ON CONFLICT (id) DO NOTHING;

-- +goose Down

DROP TABLE IF EXISTS site_settings;
