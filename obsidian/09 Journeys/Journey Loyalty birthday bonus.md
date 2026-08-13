---
tags: [journey]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Loyalty birthday bonus

**Status:** live PH-040b

## Actor

System cron + customers with `users.birth_date`

## Happy path

1. Daily job runs in **`Asia/Tehran`** (configurable)
2. Selects active users whose birth month-day matches “today” in that TZ
3. Awards `LOYALTY_BIRTHDAY_BONUS` with ledger key `birthday` / `user` / `{userID}:{YYYY}`
4. Second run same year is a no-op (unique conflict)

## Edge cases

- Null `birth_date` → skip  
- 29 Feb → treat as 28 Feb in non-leap years  
- Job continues on per-user errors  

## Related

[[Loyalty Backend]] · [[Loyalty Wallet Gift Cards]] · [[Users Backend]] · [[Processes and Jobs]]

#journey
