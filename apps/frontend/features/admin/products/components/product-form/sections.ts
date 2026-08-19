"use client";

import * as React from "react";

/**
 * The product editor's six sections, addressable by `?tab=` (PE-5).
 *
 * Search params, not route segments: a segment per section would remount the
 * form on every switch and take the whole react-hook-form state — including a
 * gallery of staged uploads that only exists in memory — with it. So all six
 * stay mounted and only one is shown.
 */
export const PRODUCT_FORM_SECTIONS = [
  { key: "general", label: "اطلاعات کلی", hint: "نام، دسته، برند" },
  { key: "specs", label: "مشخصات", hint: "وزن، مبدأ، ABV" },
  { key: "tags", label: "برچسب‌ها" },
  { key: "variants", label: "تنوع و قیمت", hint: "SKU، قیمت، موجودی" },
  { key: "images", label: "رسانه" },
  { key: "seo", label: "سئو", hint: "اختیاری" },
] as const;

export type ProductFormSectionKey =
  (typeof PRODUCT_FORM_SECTIONS)[number]["key"];

export const PRODUCT_FORM_SECTION_PARAM = "tab";

const DEFAULT_SECTION: ProductFormSectionKey = "general";

export function productFormSectionId(key: ProductFormSectionKey) {
  return `product-section-${key}`;
}

function isSectionKey(value: string | null): value is ProductFormSectionKey {
  return PRODUCT_FORM_SECTIONS.some((section) => section.key === value);
}

export function readProductFormSection(search: string): ProductFormSectionKey {
  const value = new URLSearchParams(search).get(PRODUCT_FORM_SECTION_PARAM);
  return isSectionKey(value) ? value : DEFAULT_SECTION;
}

export function productFormSectionHref(
  search: string,
  key: ProductFormSectionKey,
) {
  const params = new URLSearchParams(search);
  if (key === DEFAULT_SECTION) params.delete(PRODUCT_FORM_SECTION_PARAM);
  else params.set(PRODUCT_FORM_SECTION_PARAM, key);
  const qs = params.toString();
  return qs ? `?${qs}` : "?";
}

/**
 * Which section holds a given jump target — the error summary links to field
 * ids, and a link into a hidden section is a broken link (PE-6 → PE-5).
 *
 * Field ids are the form paths themselves and collapsible headers are
 * `{sectionId}-trigger`, so this stays a pattern match rather than a second
 * registry that can drift out of step with the markup.
 */
export function productFormSectionForTarget(
  targetId: string,
): ProductFormSectionKey | undefined {
  if (/^variants(\.|$)|^product-variants/.test(targetId)) return "variants";
  if (/^product-images/.test(targetId)) return "images";
  if (/^tag_ids$|^product-tags/.test(targetId)) return "tags";
  if (/^(country_of_origin|abv|weight)$|^product-specifications/.test(targetId))
    return "specs";
  if (/^meta_|^product-seo/.test(targetId)) return "seo";
  if (
    /^(title|slug|code|category_id|brand_id|description)$/.test(targetId) ||
    /^product-general/.test(targetId)
  ) {
    return "general";
  }
  return undefined;
}

/**
 * The visible section, kept in the URL so it can be linked to and stepped
 * through with back/forward.
 *
 * `history.pushState` rather than `router.push`: the section is client state
 * on an already-rendered page, and a router navigation would round-trip to the
 * server for a product the form has already loaded — and re-run the page for
 * every price edit. The existing history state is spread through so the
 * unsaved-changes guard's marker survives the push.
 */
export function useProductFormSection() {
  const [{ section, search }, setLocation] = React.useState({
    section: DEFAULT_SECTION as ProductFormSectionKey,
    search: "",
  });

  React.useEffect(() => {
    const sync = () =>
      setLocation({
        section: readProductFormSection(window.location.search),
        search: window.location.search,
      });
    // The URL is read after mount, never during render, so the server markup
    // and the first client render agree on both the open section and the
    // hrefs the nav paints.
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const selectSection = React.useCallback(
    (key: ProductFormSectionKey, { push = true }: { push?: boolean } = {}) => {
      const url = new URL(window.location.href);
      if (key === DEFAULT_SECTION) {
        url.searchParams.delete(PRODUCT_FORM_SECTION_PARAM);
      } else {
        url.searchParams.set(PRODUCT_FORM_SECTION_PARAM, key);
      }
      setLocation({ section: key, search: url.search });
      if (url.href === window.location.href) return;
      const state = { ...(window.history.state as object | null) };
      if (push) window.history.pushState(state, "", url);
      else window.history.replaceState(state, "", url);
    },
    [],
  );

  return { section, search, selectSection };
}
