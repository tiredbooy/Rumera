---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug media broken image

1. Stored value origin-independent? (`/media/...` not host baked)
2. `NEXT_PUBLIC_MEDIA_BASE_URL` or API URL set for split origins
3. Split-origin `next/image` src: that host must be in `images.remotePatterns` (baked from those env vars at Next config load — not `**`)
4. Prod: configured origin https?
5. Path goes through `resolveMediaUrl` / StorefrontMedia?
6. Backend transform route up? key exists on disk?
7. SW not caching cross-origin incorrectly?

Related: [[Media Pipeline]] · [[Media and Cache FE]] · [[ADR Origin-independent media paths]]
