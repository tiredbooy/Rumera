-- +goose Up
-- P0-1. Account → Addresses wrote country as the Persian literal "ایران" while
-- shipping_zones.region_codes holds uppercase ISO 3166-1 codes. zone_repository.go
-- compares them literally, so every address saved from the account page resolved to
-- zero zones and the customer hit «روش ارسالی برای منطقهٔ شما یافت نشد» at checkout
-- step 2 with no way forward. Addresses saved from the checkout inline form already
-- wrote "IR" and worked — this reconciles the rest.
UPDATE addresses
SET country = 'IR'
WHERE UPPER(TRIM(country)) IN ('ایران', 'IRAN', 'IRN');

-- The zone lookup uppercases the request, so anything still stored in mixed case
-- matched only by luck. Fold it once here; addresses/service.go keeps it that way.
UPDATE addresses
SET country = UPPER(TRIM(country))
WHERE country <> UPPER(TRIM(country));

-- +goose Down
-- Irreversible by design: the original per-row spelling is not recoverable, and
-- restoring it would re-break checkout for those customers.
SELECT 1;
