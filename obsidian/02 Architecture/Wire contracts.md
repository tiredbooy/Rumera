---
tags: [architecture, api]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Wire contracts

## Source of truth

Go **JSON tags** on response/request structs + mappers + response envelope — **not** DB models alone.

## Where types live (PH-012a)

| Layer | Location |
|-------|----------|
| Domain + most wire DTOs | `internal/features/<name>/` (e.g. inventory, payments `model.go`) |
| Shared only | `internal/models` (errors, filters, patch, PaymentMethod, shared product wire, TaxRate) |
| HTTP error map | `platform/httpx.HandleError` for `models.Err*` |

**Decision tree:** one-feature → feature package; pure shared primitive →
`models`; multi-feature entity that would cycle → `models` until a dedicated
shared package exists (catalogue wire DTOs today).

Do not grow `internal/models` into a god package. No big-bang move of product
list/detail DTOs without a cycle plan. See repo `conventions.md` § Models
ownership · `models/doc.go` · [[Backend package map]].

## Mapping rules (refactor policy)

| Go / API | TypeScript |
|----------|------------|
| `time.Time` | ISO `string` |
| `decimal.Decimal` | `string` |
| IDs | number or UUID as backend sends |
| `omitempty` pointer | optional property |
| Non-omitempty pointer | required nullable |
| Property names | **snake_case** wire keys |

Business names preferred (`Order`, `ProductDetail`) over `FooDTO`.

## Frontend

- Types live in domain `features/*/types.ts`
- Never invent fields for UI convenience
- [[Term envelope]] for success/error/pagination

Related: [[Error model]] · [[Money and stock rules]] · [[Backend API]] · [[Backend package map]] · [[Layered Backend]] · [[Frontend Domain Map]] · [[Glossary]]

Bridge: backend `conventions.md` · `architecture/domain-map.md`

#architecture
