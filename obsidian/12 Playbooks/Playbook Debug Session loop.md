---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug session loop

Redirect login ↔ account loops.

1. `AUTH_SECRET` / `AUTH_URL` / site URL aligned
2. Middleware vs layout guard mismatch
3. Refresh rotation only on Auth.js routes (not naked BFF refresh)
4. Cookie Secure/SameSite behind proxy
5. Role insufficient for `/admin` → forbidden not login loop

Related: [[Auth and Sessions]] · [[BFF Proxies]] · [[Surface Auth]] · [[Surface Account]]
