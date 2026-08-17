import { siteConfig } from "@/lib/site";

export const SEO_TITLE_LIMIT = 60;
export const SEO_DESCRIPTION_LIMIT = 155;

export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function truncateSeo(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

export function seoDocumentTitle(metaTitle: string, fallbackTitle: string): string {
  const page = firstNonEmpty(metaTitle, fallbackTitle) || "بدون عنوان";
  return `${page} · ${siteConfig.name}`;
}

export function seoSnippetDescription(
  metaDescription: string,
  ...fallbacks: Array<string | null | undefined>
): string {
  return firstNonEmpty(metaDescription, ...fallbacks);
}

export function parseKeywordList(value: string): string[] {
  return value
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatKeywordList(values?: string[] | null): string {
  return (values ?? []).join("، ");
}

export function previewPath(
  canonical: string,
  fallbackPath: string,
): string {
  const custom = canonical.trim();
  if (!custom) return fallbackPath;
  try {
    const url = new URL(custom, siteConfig.url);
    return url.pathname + url.search;
  } catch {
    return custom.startsWith("/") ? custom : `/${custom}`;
  }
}

export function previewDisplayUrl(pathOrUrl: string): string {
  try {
    const url = new URL(pathOrUrl, siteConfig.url);
    const path = `${url.pathname}${url.search}`.replace(/\/$/, "") || "/";
    return `${url.host.replace(/^www\./, "")} › ${path.replace(/^\//, "").replaceAll("/", " › ")}`;
  } catch {
    return pathOrUrl;
  }
}
