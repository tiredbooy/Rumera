# Vendored fonts (OG / Satori)

Static **Vazirmatn** TTFs used by `app/opengraph-image.tsx` via `next/og`
(`ImageResponse`). Satori cannot load Google Fonts CSS at edge time the same way
`next/font` does, so these files live in-repo.

| File | Weight | Use |
|------|--------|-----|
| `Vazirmatn-Regular.ttf` | 400 | Body / description |
| `Vazirmatn-SemiBold.ttf` | 600 | Wordmark / title |
| `Vazirmatn-Bold.ttf` | 700 | Optional emphasis |

**Source:** [rastikerdar/vazirmatn](https://github.com/rastikerdar/vazirmatn) v33.003  
**License:** SIL Open Font License 1.1 (see upstream)

Do not delete these when cleaning `public/` — social previews depend on them.
