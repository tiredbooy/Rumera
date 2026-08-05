---
tags: [frontend]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 04 Frontend]]


# Image Uploader

## What it is

Shared admin media upload stack for product/content forms: dropzone, multi-slot list, progress, validation constants.

## Code map

| Piece | Path |
|-------|------|
| Main composer | `features/image-uploader/ImageUploader.tsx` |
| Dropzone / slots | `ImageDropzone`, `ImageSlotList`, `ImageSlotItem` |
| Hook | `use-image-uploader.ts` |
| Client | `client.ts` → admin upload BFF |
| Constants/tests | `constants.ts`, `*.test.tsx` |

## Backend contract

Uploads hit admin media endpoints; ownership and compensation rules are [[Media Pipeline]] (owner attach, standalone release, reconcile).

After successful product/content writes, revalidate public tags → [[Media and Cache FE]].

## Related

[[Admin Console]] · [[Catalogue]] · [[Recipes and Journal]] · [[Hero and Home]] · [[Journey Admin publish product]] · [[Frontend Domain Map]]

#frontend
