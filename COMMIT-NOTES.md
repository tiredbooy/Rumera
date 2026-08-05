# Commit notes (uncommitted work)

Use this as a checklist when you are ready to commit. Nothing here has been
committed by the agent. Suggested split keeps security upgrades reviewable
and separate from the Next.js proxy rename.

---

## Suggested commit 1 — Frontend dependency security upgrades

**Scope:** `apps/frontend/package.json`, `apps/frontend/package-lock.json`

**Message:**

```
chore(frontend): clear npm audit via safe dependency upgrades

Upgrade runtime and tooling packages to fixed versions without majors or
forced downgrades. Drop unused uploadthing (pinned vulnerable effect with no
fixed 7.x release). Result: npm audit reports 0 vulnerabilities.
```

**Key version moves**

| Package | From | To | Why |
|---------|------|-----|-----|
| `axios` | 1.17.x | **1.19.0** | DoS / prototype-pollution advisories |
| `next-auth` | 5.0.0-beta.31 | **5.0.0-beta.32** | Auth.js criticals via `@auth/core@0.41.3` |
| `next` | 16.2.6 | **16.3.0** | Framework security + sharp/postcss |
| `eslint-config-next` | 16.2.6 | **16.3.0** | Lockstep with Next |
| `@sentry/nextjs` | 10.56.x | **10.69.0** | OTel / bundler transitive fixes |
| `posthog-js` | 1.382.x | **1.412.0** | dompurify fix path |
| `shadcn` | 4.10.x | **4.16.1** | CLI/MCP transitive fixes |
| `uploadthing` | 7.7.4 | **removed** | Unused; only source of vulnerable `effect` |

Also applied a normal `npm audit fix` (no `--force`) so remaining safe
transitives (hono, undici, js-yaml, brace-expansion, etc.) resolved cleanly.

**Verify before commit**

```bash
cd apps/frontend
npm audit          # expect: found 0 vulnerabilities
npm run typecheck
npm run test
npm run build
```

---

## Suggested commit 2 — Middleware → Proxy (Next.js 16)

**Scope:**

- `apps/frontend/middleware.ts` → **deleted**
- `apps/frontend/proxy.ts` → **added** (same auth gate logic)
- Comment/doc updates under `apps/frontend/lib/auth/` and `apps/frontend/docs/`

**Message:**

```
refactor(frontend): migrate Next.js middleware convention to proxy

Next.js 16 renames the edge file convention from middleware to proxy. Move
the auth coarse-gate + noindex headers to proxy.ts with behaviour unchanged,
and update platform docs to match.
```

**Behaviour (unchanged)**

- Edge-safe NextAuth wrapper (`authConfig`)
- Coarse gate for `/account` and `/admin` (login redirect, refresh handoff)
- `X-Robots-Tag: noindex, nofollow` on private surfaces
- Same `config.matcher` exclusions for static assets and `/api/auth`

**Verify before commit**

```bash
cd apps/frontend
npm run typecheck
npm run build      # should not warn about middleware deprecation
# Manual smoke: unauthenticated /admin and /account → /login?callbackUrl=...
```

---

## Optional follow-ups (not done here)

- [ ] Next.js codemod path `middleware` → `proxy` is complete; optional future
      move of auth gates into layout-only if you want zero edge auth.
- [ ] Re-add media upload library only when a package ships without vulnerable
      transitive deps (or wire the existing image-uploader path fully).
- [ ] Pre-existing `npm run lint` issues (e.g. checkout-flow setState-in-effect,
      test `require()` imports) are unrelated to these changes.

---

## Quick one-shot if you prefer a single commit

```
chore(frontend): security dependency upgrades and middleware-to-proxy migration

- Bump next, next-auth, axios, sentry, posthog, shadcn; remove unused uploadthing
- npm audit: 0 vulnerabilities
- Rename edge gate middleware.ts → proxy.ts (Next.js 16 convention)
```

Files for a single commit would include everything listed in commits 1 and 2.
