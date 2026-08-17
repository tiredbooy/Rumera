-- +goose Up
-- PR-040c: split ledger minting off customers:write.
-- wallet:credit is the dedicated grant for POST /admin/users/:id/wallet/credit.
-- Admin seed receives it (superuser / matrix UI). Staff seed does not —
-- customers:write must not print money.

UPDATE role_capabilities
SET permissions = (
        SELECT ARRAY(
            SELECT DISTINCT unnest(permissions || ARRAY['wallet:credit']::TEXT[])
            ORDER BY 1
        )
    ),
    updated_at = NOW()
WHERE role = 'admin'
  AND NOT ('wallet:credit' = ANY (permissions));

-- +goose Down
UPDATE role_capabilities
SET permissions = array_remove(permissions, 'wallet:credit'),
    updated_at = NOW()
WHERE 'wallet:credit' = ANY (permissions);
