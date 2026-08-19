import { fireEvent, screen } from "@testing-library/react";

import type { ProductFormSectionKey } from "./components/product-form/sections";

const SECTION_LINK_NAMES: Record<ProductFormSectionKey, RegExp> = {
  general: /اطلاعات کلی/,
  specs: /مشخصات/,
  tags: /برچسب‌ها/,
  variants: /تنوع و قیمت/,
  images: /رسانه/,
  seo: /سئو/,
};

/**
 * Opens one `?tab=` section of the product editor (PE-5). Only the open
 * section is rendered, so a test that reaches into another one has to say so.
 */
export function openProductSection(key: ProductFormSectionKey) {
  fireEvent.click(screen.getByRole("link", { name: SECTION_LINK_NAMES[key] }));
}
