"use client";

import type { ProductImage } from "@/lib/catalog/types";

export function uploadProductImage(
  productId: number,
  file: File,
  opts: { altText?: string; isPrimary?: boolean },
  onProgress?: (fraction: number) => void,
): Promise<ProductImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    if (opts.altText) form.append("alt_text", opts.altText);
    if (opts.isPrimary) form.append("is_primary", "true");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/products/${productId}/images`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve((body?.data ?? body) as ProductImage);
        } else {
          reject(new Error(body?.error?.message ?? "بارگذاری ناموفق بود"));
        }
      } catch {
        reject(new Error("پاسخ نامعتبر از سرور"));
      }
    };
    xhr.onerror = () => reject(new Error("خطای شبکه"));
    xhr.send(form);
  });
}
