"use client";

import type {
  ApiErrorEnvelope,
  ApiSuccess,
  Paginated,
} from "@/lib/api/types";
import { buildQueryString } from "@/lib/utils/api-helpers";
import type { PublicProductListQuery } from "@/features/catalog/products/queries";
import type {
  ProductImage,
  ProductListItem,
  ProductVariant,
} from "@/features/catalog/products/types";

export class ProductClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProductClientError";
  }
}

async function productRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/${path}`);
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new ProductClientError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

export function listSelectableProducts(
  query: PublicProductListQuery = {},
): Promise<Paginated<ProductListItem>> {
  return productRequest<Paginated<ProductListItem>>(
    `products${buildQueryString(query)}`,
  );
}

export function listProductVariants(
  productId: number,
): Promise<ProductVariant[]> {
  return productRequest<ProductVariant[]>(`products/${productId}/variants`);
}

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
    xhr.open("POST", `/api/admin/admin/products/${productId}/images`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as
          | ApiSuccess<ProductImage>
          | ApiErrorEnvelope;
        if (xhr.status >= 200 && xhr.status < 300) {
          if (!("data" in body)) throw new Error("پاسخ نامعتبر از سرور");
          resolve(body.data);
        } else {
          const error = "error" in body ? body.error : undefined;
          reject(new Error(error?.message ?? "بارگذاری ناموفق بود"));
        }
      } catch {
        reject(new Error("پاسخ نامعتبر از سرور"));
      }
    };
    xhr.onerror = () => reject(new Error("خطای شبکه"));
    xhr.send(form);
  });
}
