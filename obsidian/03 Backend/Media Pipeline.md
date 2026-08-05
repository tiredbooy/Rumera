---
tags:
  - backend
  - media
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 03 Backend]]


# Media Pipeline

- Upload with **ownership** (product / content)
- DB stores origin-independent `/media/{key}` or external https
- `GET /media/*` transform (`f`, `w`, `h`, `q`, `fit`)
- Reconcile orphans: `cmd/media-reconcile`

Frontend joins origin only in resolver → [[Media and Cache FE]].

Related: [[Catalogue]] · [[Recipes and Journal]] · [[Admin Console]]

Bridge: `apps/backend/docs/architecture/media-pipeline.md`

#backend #media
