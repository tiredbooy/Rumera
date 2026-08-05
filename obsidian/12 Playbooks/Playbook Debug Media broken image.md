---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug media broken image

1. Stored value origin-independent? (`/media/...` not host baked)
2. `NEXT_PUBLIC_MEDIA_BASE_URL` or API URL set for split origins
3. Prod: configured origin https?
4. Path goes through `resolveMediaUrl` / StorefrontMedia?
5. Backend transform route up? key exists on disk?
6. SW not caching cross-origin incorrectly?

Related: [[Media Pipeline]] · [[Media and Cache FE]] · [[ADR Origin-independent media paths]]
