---
tags: [playbook]
---

<!-- brain-hub -->
**Brain:** [[Project Brain]] · [[Connect 12 Playbooks]]


# Playbook: Debug stale storefront cache

Admin edited product but storefront old.

1. Mutation went through admin BFF success path?
2. `getAdminRevalidationPlan` covers that path?
3. Tag on public fetch matches plan tags? ([[Term cache tag]])
4. CDN/browser cache separate from Next cache?
5. Short TTL still? wait revalidate seconds

Related: [[Media and Cache FE]] · [[Admin Console]] · [[Catalogue]]
