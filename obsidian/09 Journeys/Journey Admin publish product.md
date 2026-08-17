---
tags: [journey, admin]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 09 Journeys]]


# Journey: Admin publish product

1. Admin products create/edit · variants · images ([[Media Pipeline]])
2. Upload via image-uploader → owned media
3. Save (editor aggregate or legacy product+variant) inserts a **zero-stock** [[Inventory]] row for every new variant in the same TX. Restock via [[Journey Admin restock]] before the SKU is purchasable.
4. Save → toast → `/admin/products` list (server-paginated; `q`/`search` + `is_active` on `GET /admin/products`) (`router.refresh()`) → admin revalidation → [[Media and Cache FE]] tags
5. Appears on catalogue / home when active

**Write gate (PR-011b):** `/admin/products/[id]` is `products:read` so staff can
**open** the editor. Save, image upload, and mutating variant tools require
`products:write` (`canWrite` on `ProductForm`). Create stays write-gated at the
page. Readers see a short Persian “فقط مشاهده” hint — they are not 403’d.
Backend write routes remain the real [[RBAC]] boundary.

**Option catalog (PR-011c):** Brand / category / tag lookups still throw (admin
`error.tsx`). A failed option-types N+1 does **not** take the editor down.
Variants keep the empty-options chrome plus a distinct Persian load error and
«تلاش دوباره» (`router.refresh()`). An empty catalog with no error still says
«هنوز ویژگی مشترکی تعریف نشده». See [[Admin Console]] · [[Catalogue]].

Related: [[Catalogue]] · [[Admin Console]] · [[RBAC]] · [[Journey Admin restock]] · [[Inventory Backend]]

#journey
