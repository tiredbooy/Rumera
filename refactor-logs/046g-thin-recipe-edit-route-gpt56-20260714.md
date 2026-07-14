# Task 046g: Thin Recipe-Edit Route

**Status:** Complete
**Date:** 2026-07-14

- Added server-only `RecipeEditView` beside `RecipeCreateView` and reused the
  shared tag loader.
- Reduced the route to `RECIPES_READ`, async parameter resolution, and the view.
- Preserved the admin hydrated/draft-capable read, raw string ID, 404 conversion,
  tag fallback, header copy, back link, and exact `RecipeForm` props.
- Scoped ESLint, full typecheck, ownership/stale-import searches, and diff check
  passed.
