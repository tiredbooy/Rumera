---
tags: [architecture, api]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 02 Architecture]]


# Wire contracts

## Source of truth

Go **JSON tags** on response/request structs + mappers + response envelope — **not** DB models alone.

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

Related: [[Error model]] · [[Money and stock rules]] · [[Backend API]] · [[Frontend Domain Map]] · [[Glossary]]

Bridge: `refactor-workstreams/Refactor-Docs/TASKS.md` contract policy · backend `conventions.md`

#architecture
