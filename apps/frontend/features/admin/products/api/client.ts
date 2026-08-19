"use client";

import type {
  ApiErrorEnvelope,
  ApiFieldErrors,
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
import type {
  AdminProductDetail,
  SaveProductAggregateInput,
} from "@/features/admin/products/types";

export class ProductClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: ApiFieldErrors,
  ) {
    super(message);
    this.name = "ProductClientError";
  }
}

async function productRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new ProductClientError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? response.statusText,
      error?.fields,
    );
  }

  return ((body as ApiSuccess<T> | null)?.data ?? body) as T;
}

/** Re-reads the product so a stale-revision conflict can be rebased (PE-2). */
export function getAdminProduct(
  productId: number,
): Promise<AdminProductDetail> {
  return productRequest<AdminProductDetail>(`admin/products/${productId}`);
}

export function saveProductAggregate(
  productId: number | null,
  payload: SaveProductAggregateInput,
): Promise<AdminProductDetail> {
  const path =
    productId === null
      ? "admin/products/aggregate"
      : `admin/products/${productId}/aggregate`;
  return productRequest<AdminProductDetail>(path, {
    method: productId === null ? "POST" : "PUT",
    body: JSON.stringify(payload),
  });
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

export function addProductImageURL(
  productId: number,
  imageUrl: string,
  opts: { altText?: string; isPrimary?: boolean },
): Promise<ProductImage> {
  return productRequest<ProductImage>(
    `admin/products/${productId}/images/url`,
    {
      method: "POST",
      body: JSON.stringify({
        image_url: imageUrl,
        alt_text: opts.altText || null,
        is_primary: opts.isPrimary ?? false,
      }),
    },
  );
}
