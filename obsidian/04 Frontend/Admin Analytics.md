---
tags: [frontend, admin]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Admin Analytics

## What it is

Staff dashboards for revenue, products, search terms, events — backed by analytics DB APIs (not the main catalogue DB joins).

## Surfaces

| Area | Components (under `features/admin/analytics/`) |
|------|--------------------------------------------------|
| Admin home | `RevenueCards`, `RevenueChartSection`, `OrderStatusSection`, `RecentOrdersTable`, `LowStockList` |
| Boards | `DashboardBoard`, KPIs, range toggle |
| Search analytics | `AnalyticsSearchTerms` (top / zero-result / converting) |
| Products | `AnalyticsTopProducts` |
| Events | `AnalyticsEventBreakdown` |
| Monitoring (related) | separate [[Admin Console]] monitoring board |

## Data

- Client/server helpers in `features/analytics/api.ts`
- Permission: typically `analytics:read` → [[RBAC]]
- Backend rollups: [[Analytics]] · [[Search Backend]] search_summary job

## Truthfulness

Unconfigured/offline Prometheus is separate (monitoring). Analytics APIs should show empty/error states without inventing series.

## Related

[[Analytics]] · [[Admin Console]] · [[Search]] · [[Observability]] · [[Surface Admin]]

#frontend #admin
