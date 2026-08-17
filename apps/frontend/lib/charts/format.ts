import { faNum } from "@/lib/products"

export { faNum }

/** Persian-digit axis tick for counts. */
export function faTick(value: number): string {
  return faNum(value)
}

/** Toman axis tick: millions + «م» (e.g. ۱۸م). */
export function faMoneyTick(value: number): string {
  return `${faNum(Math.round(value / 1_000_000))}م`
}

/** Full Toman tooltip / label — Persian digits + «تومان». */
export function faToman(value: number): string {
  return `${faNum(value)} تومان`
}
