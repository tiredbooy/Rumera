export const wishlistKeys = {
  all: ["wishlist"] as const,
  membership: (variantId: number | undefined) =>
    ["wishlist", "has", variantId] as const,
};
