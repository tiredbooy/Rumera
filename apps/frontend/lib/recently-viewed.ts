"use client"

import { useSyncExternalStore } from "react"

/**
 * Recently-viewed products — a tiny localStorage ring (most-recent first,
 * de-duplicated by slug, capped). Purely client-side so it works for guests and
 * needs no backend. Exposed through `useSyncExternalStore` so reads are
 * hydration-safe and update live (same tab via a custom event, cross-tab via
 * `storage`). `recordRecentlyViewed()` is safe to call on every PDP mount.
 */
const KEY = "rumera:recently-viewed"
const CAP = 12
const EVENT = "rumera:recently-viewed-change"

export type RecentProduct = {
  slug: string
  title: string
  image?: string
  price?: number
}

let cache: RecentProduct[] | null = null
const EMPTY: RecentProduct[] = []

function read(): RecentProduct[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as RecentProduct[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return EMPTY
  }
}

function getSnapshot(): RecentProduct[] {
  if (cache === null) cache = read()
  return cache
}

function getServerSnapshot(): RecentProduct[] {
  return EMPTY
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", cb)
  }
}

export function recordRecentlyViewed(item: RecentProduct) {
  if (!item.slug || typeof window === "undefined") return
  const next = [item, ...read().filter((p) => p.slug !== item.slug)].slice(0, CAP)
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* quota / disabled storage — ignore */
  }
  cache = next
  window.dispatchEvent(new Event(EVENT))
}

/** Recently-viewed list, optionally excluding one slug (e.g. the current PDP). */
export function useRecentlyViewed(excludeSlug?: string): RecentProduct[] {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return excludeSlug ? all.filter((p) => p.slug !== excludeSlug) : all
}
