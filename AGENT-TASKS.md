# AGENT-TASKS — Admin image pipeline + dashboard/product enhancements

> **Temporary coordination file.** It is deleted and removed from git once every
> task below is checked off. Spec: [`docs/superpowers/specs/2026-06-16-admin-images-dashboard-design.md`](docs/superpowers/specs/2026-06-16-admin-images-dashboard-design.md)

## Working agreement (read before starting)

1. **Two agents, run one at a time.** Agent A finishes fully, then Agent B starts.
   Never run both pushing to `dev` at the same time.
2. **Strict directory ownership — do not cross it:**
   - **Agent A:** `apps/backend/**`, `infra/**`, `docker-compose*.yml`, root
     `Makefile`, `docs/**` (the doc move). Owns this `AGENT-TASKS.md` while A runs.
   - **Agent B:** `apps/frontend/**` only. Owns this `AGENT-TASKS.md` while B runs.
   - Never stage `.claude/**` (leave local settings alone). Use `git add` with
     explicit paths — never `git add -A` / `git add .`.
3. **One commit + push per task.** When a task is done:
   1. Verify it (build/lint/vet as noted in the task).
   2. Tick its checkbox here (`[ ]` → `[x]`) and append ` — done <short note>`.
   3. `git pull --rebase origin dev` (paths are disjoint between agents → no
      conflicts), then `git add <explicit paths> AGENT-TASKS.md`, commit, push:
      ```
      git commit -m "<type>(<scope>): <task summary>"
      git push origin dev
      ```
   - Commit types: `feat`, `fix`, `chore`, `refactor`, `docs`, `build`.
4. **Build to the frozen API contract** in the spec. Do not invent new shapes.
5. **Frontend caveat:** `apps/frontend/AGENTS.md` says this Next.js has breaking
   changes — read `node_modules/next/dist/docs/` before writing frontend code.
6. **UI bar:** follow `ui-ux-pro-max` — premium dark+gold, RTL, 44px touch
   targets, visible focus states, skeletons, `prefers-reduced-motion`, responsive
   375/768/1024/1440, SVG icons (no emoji), `cursor-pointer` on interactives.
7. **Stay in scope.** Local disk storage only, on-the-fly transform only. No
   MinIO/S3, no CDN, no pre-gen variants, no new frontend deps.
8. When **all** boxes are checked, the orchestrator deletes this file and
   `git rm AGENT-TASKS.md` in a final commit.

---

## Agent A — Backend image optimization + infra (`apps/backend`, infra, docs)

- [x] **A0 · Housekeeping.** — done: `git mv` to `docs/`, fixed links in DOCKER.md + frontend README + job comment. Move `DOCKER.md` → `docs/DOCKER.md` and
  `FEATURE-ROADMAP.md` → `docs/FEATURE-ROADMAP.md` (`git mv`); fix any links that
  reference them. Verify nothing else points at the old paths. Commit `chore(docs): move root docs into docs/`.
- [x] **A1 · Storage layer.** — done: `pkg/storage` Storage interface + atomic LocalStorage, traversal-rejecting `resolve`, tests green. Add `pkg/storage` with a `Storage` interface
  (`Put`, `Open`, `Exists`, `Delete`) and a `LocalStorage` impl writing under
  `MEDIA_ROOT`, keys `products/{uuid}.{ext}`. Unit-test path-safety (no `..`
  escape). `go build ./... && go vet ./...`.
- [ ] **A2 · Config + DI.** Add the `MEDIA_*` env vars to `internal/config`, wire
  `Storage` + media service into `internal/bootstrap/container.go`. Defaults per
  spec table.
- [ ] **A3 · DB migration.** Goose migration in `migrations/main` adding
  `storage_key TEXT` (nullable) to `product_images`. Up + Down. Update
  `models/product.go` (`ProductImage.StorageKey *string`) and the mapper/response.
- [ ] **A4 · Media service.** Implement upload (validate MIME/size/dimensions →
  store original → insert `product_images` row) and transform (cache lookup →
  bimg decode/resize/encode → write `MEDIA_CACHE_DIR` → return bytes + content
  type). Add the param parser + cache-key hasher with unit tests. Use
  `github.com/h2non/bimg` (`go get`).
- [ ] **A5 · Handlers + routes.** Implement the endpoints in the frozen contract:
  `POST/GET/PUT/PATCH/DELETE /api/v1/admin/products/:id/images*` (admin group `a`)
  and public `GET /media/*key`. Register in `internal/routes/routes.go`. Content
  negotiation from `Accept` when `f` omitted; long-lived `Cache-Control`.
- [ ] **A6 · Docker/infra.** Add `libvips` (build + runtime) to the backend
  Dockerfile dev+prod stages; add the `MEDIA_ROOT`/`MEDIA_CACHE_DIR` volume to
  `docker-compose.dev.yml` and `docker-compose.prod.yml`; expose the `MEDIA_*`
  env. Route `/media/` to the Go API in `infra/nginx` (same upstream as `/api`),
  with a long `proxy_cache`/`expires` for transformed responses. Confirm
  `go build ./...` still green.
- [ ] **A7 · Verify A.** `gofmt`, `go vet ./...`, `go build ./...`, run new unit
  tests. Note in the commit that an upload→`/media/...?f=avif` round-trip is the
  acceptance check (manual, needs libvips).

## Agent B — Admin frontend (`apps/frontend` only)

- [ ] **B1 · OptimizedImage helper.** Add `components/admin/optimized-image.tsx`
  building `/media/{key}?f=&q=&w=` URLs with `srcset` + lazy loading. Reads
  `MEDIA_PUBLIC_BASE_URL` (or same-origin). Typed against `ProductImage`.
- [ ] **B2 · Admin API hooks.** Extend `lib/api/admin-hooks.ts` (and any proxy in
  `app/api/store|public`) with image upload/list/reorder/primary/delete calls per
  the frozen contract. Multipart upload with progress.
- [ ] **B3 · Product form rewrite.** Replace the mock scaffold in
  `components/admin/product-form.tsx` with a form bound to the real `Product`
  shape + admin hooks: general/pricing/variants/specs/SEO sections, client-side
  validation, and a **multi-image uploader** (drag-drop, reorder, set primary,
  alt text, per-file progress + error, remove). Live preview via `OptimizedImage`.
- [ ] **B4 · Wire create/edit pages.** Hook `app/admin/products/new/page.tsx` and
  `app/admin/products/[id]/page.tsx` to real create/update + image endpoints
  (optimistic where sensible). Handle the create-then-upload order (need product
  id first) gracefully.
- [ ] **B5 · Dashboard polish.** Refine `app/admin/page.tsx` + `components/admin/`
  cards/charts/tables to the `ui-ux-pro-max` bar: skeletons, focus states, 44px
  targets, RTL, responsive 375/768/1024/1440, `prefers-reduced-motion`. No new
  deps.
- [ ] **B6 · Verify B.** `lint` + `build` (or `tsc --noEmit`) green; manual check
  of 375/768/1024/1440 and the upload flow against the live backend.

---

## Done log

_(agents append `<task> — <commit sha> — <note>` lines as they finish)_
