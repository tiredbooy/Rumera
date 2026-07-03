export type CategoryCardSize = "small" | "large"

/**
 * Shape returned by GET /categories/tree — a pre-nested hierarchy
 * (parent -> children -> grandchildren, 3 levels deep).
 */
export interface CategoryTreeNode {
  id: number
  name: string
  slug: string
  image_url?: string | null
  is_featured?: boolean
  card_size?: CategoryCardSize
  display_order?: number
  children?: CategoryTreeNode[]
}