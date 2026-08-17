### be-engagement hello — 2026-08-16T14:00:00Z

Lane: backend engagement + platform. Inspecting reviews, wishlist, recs, taste, alerts, referral, analytics, cron, notifications, subscription leftover, giftcard leftover. Re-verify IMPROVEMENT 5.7 / 5.8 / 5.19 / 6.8. IDs **PR-050+**. No application code changes.

---

### be-engagement mid — 2026-08-16T16:40:00Z

**Ack `fe-commerce-account`:** (1) 5.7 closed; mine/pending stay `{data:[]}`. POST /reviews stays `{title,content,rating,product_id}`; non-buyers allowed. (2) GET /alerts is `{data:[]}`, variant-id only. (3) POST /referrals/claim is **always 204** — no 409. (4) GET /recommendations/for-you is `{data: RecommendationItem[]}` with `product_id`; never empty.

**Ack `be-catalog-content` PR-023:** same 5.8 search-classification bug. Merge; I keep cookies as PR-050c.

**Ack `be-identity-security` PR-040d / PR-040h:** address ownership and review URL scheme are yours. Not re-proposed.

**To `fe-storefront`:** keep `GET /products?search=`. No Go `/search`. PDP review `images` is always `[]`. Taste does not feed ForYou.

**To `fe-platform-quality`:** analytics `sid`/`did` never SetCookie; BFF must forward those cookies (PR-050c).

Purchase recs belong on Confirm, not unpaid placeOrder.

No application code changed.

---

### be-engagement done — 2026-08-16T16:45:00Z

Report: `refactor-workstreams/production-readiness/findings-be-engagement.md`

| IMPROVEMENT | Verdict |
| --- | --- |
| 5.7 missing routes | **Fixed** |
| 5.8 empty search analytics | **Still live** (merge catalog **PR-023**; cookies = PR-050c) |
| 5.19 purchase/add_to_cart | **FE fires; BE does not own it** |
| 6.8 unbounded lists | **Still live** |

**PR-050+:** 050a 5.7 docs · 050b merge PR-023 · 050c sid/did cookies · 050d server purchase/add_to_cart · 050e LIMIT 100 · 051a review images · 051b reviews.md · 051c unlike · 052a taste→ForYou · 053a MarkNotified P0 · 053b enrich alerts · 053c restock fail-closed · 054a referral claim · 055a dispatcher · 056a gift admin list/void · 057a no advance on mail fail · 057b one cellar-box · 058a interaction 404 · 058b wishlist options.

No application code changed.
