/** Category values accepted by Go's taste-profile validator. */
export type TasteCategory =
  | "Whisky"
  | "Wine"
  | "Champagne"
  | "Gin"
  | "Rum"
  | "Tequila"
  | "Vodka"

/** GET/PUT /me/taste-profile response (`models.TasteProfile`). */
export interface TasteProfile {
  categories: TasteCategory[] | null
  budget_max: number
  flavor: string[] | null
  occasions: string[] | null
}

/**
 * PUT /me/taste-profile body (`models.UpdateTasteProfileInput`).
 * Go accepts omitted properties and JSON null, decoding them to zero values.
 */
export interface UpdateTasteProfileInput {
  categories?: TasteCategory[] | null
  budget_max?: number | null
  flavor?: string[] | null
  occasions?: string[] | null
}

export interface TasteCategoryOption {
  value: TasteCategory
  label: string
  slug: string
}

export interface TasteBudgetOption {
  value: number
  label: string
}

/** Client-owned quiz choices; the backend does not expose an options endpoint. */
export interface TasteProfileOptions {
  categories: readonly TasteCategoryOption[]
  budgets: readonly TasteBudgetOption[]
  flavors: readonly string[]
  occasions: readonly string[]
}
