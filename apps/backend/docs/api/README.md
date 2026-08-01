# API Reference

Base URL: `http://localhost:8080/api/v1`

All conventions (response envelope, errors, pagination, validation) are described in [Conventions](../conventions.md). Authentication and trust tiers are in [Authentication](../authentication.md).

**Legend:** 🌐 public · 🔒 customer (any logged-in user) · 🛡️ admin only

## Resources

| Resource | Description |
|----------|-------------|
| [Auth](./auth.md) | Register, login, refresh, profile, password reset |
| [Users](./users.md) | 🛡️ Admin user management |
| [Addresses](./addresses.md) | 🔒 Customer shipping addresses |
| [Cart](./cart.md) | 🔒 Shopping cart |
| [Coupons](./coupons.md) | Validate (🔒) + admin coupon management (🛡️) |
| [Webhooks](./webhooks.md) | Signature-verified payment gateway callbacks |
| [Products](./products.md) | Catalogue products, tags, images, variants |
| [Media](./media.md) | Public media delivery and admin upload contracts |
| [Variants](./variants.md) | Product variants and their options/images |
| [Categories](./categories.md) | Category tree |
| [Brands](./brands.md) | Brands |
| [Tags](./tags.md) | Tags |
| [Orders](./orders.md) | Checkout, order history, admin fulfilment |
| [Wishlist](./wishlist.md) | 🔒 Customer wishlist |
| [Wallet](./wallet.md) | 🔒 Customer wallet & transactions |
| [Reviews](./reviews.md) | Product reviews, reactions, images, moderation |
| [Shipping](./shipping.md) | Zones, methods, checkout rates |
| [Payments](./payments.md) | 🛡️ Payment transaction records |
| [Inventory](./inventory.md) | 🛡️ Stock levels, adjustments, movements |
| [Blog](./blog.md) | Blog posts and categories |
| [Recipes](./recipes.md) | Recipes with shoppable products & SEO |
| [Hero slides](./hero-slides.md) | Storefront home-carousel slides |
| [Site settings](./site-settings.md) | Global store/contact/social/SEO/maintenance config |
| [Recommendations](./recommendations.md) | Trending, similar, FBT, personalized "for you" |
| [Analytics](./analytics.md) | 🛡️ Revenue, product, and search analytics |

## Route map

### Auth — `/auth`
| Method | Path | Tier |
|--------|------|------|
| POST | `/auth/register` | 🌐 |
| POST | `/auth/login` | 🌐 |
| POST | `/auth/refresh` | 🌐 |
| POST | `/auth/logout` | 🌐 |
| POST | `/auth/password/forgot` | 🌐 |
| GET | `/auth/password/validate` | 🌐 |
| POST | `/auth/password/reset` | 🌐 |
| GET | `/auth/me` | 🔒 |
| PATCH | `/auth/me` | 🔒 |

### Catalogue (public reads)
| Method | Path | Tier |
|--------|------|------|
| GET | `/products` | 🌐 |
| GET | `/products/:id` | 🌐 |
| GET | `/products/:id/tags` | 🌐 |
| GET | `/products/:id/images` | 🌐 |
| GET | `/products/:id/variants` | 🌐 |
| GET | `/products/:id/reviews` | 🌐 |
| GET | `/products/:id/reviews/summary` | 🌐 |
| GET | `/variants/:id` | 🌐 |
| GET | `/variants/:id/options` | 🌐 |
| GET | `/variants/:id/images` | 🌐 |
| GET | `/categories` | 🌐 |
| GET | `/categories/tree` | 🌐 |
| GET | `/categories/:id` | 🌐 |
| GET | `/categories/:id/children` | 🌐 |
| GET | `/brands` · `/brands/:id` | 🌐 |
| GET | `/tags` · `/tags/:id` | 🌐 |
| GET | `/reviews/:id` | 🌐 |
| GET | `/blogs` · `/blogs/:slug` | 🌐 |
| GET | `/blog-categories` · `/blog-categories/:id` | 🌐 |
| GET | `/hero-slides` | 🌐 |
| GET | `/settings` | 🌐 |
| GET | `/recipes` · `/recipes/featured` · `/recipes/sitemap` | 🌐 |
| GET | `/recipes/:slug` · `/recipes/:slug/related` | 🌐 |
| GET | `/products/:id/recipes` | 🌐 |
| GET | `/recommendations/trending` | 🌐 |
| GET | `/recommendations/products/:id/similar` · `/frequently-bought-together` | 🌐 |
| GET | `/shipping/zones` · `/shipping/zones/:id` | 🌐 |
| GET | `/shipping/zones/:id/methods` | 🌐 |
| GET | `/shipping/methods/:id` | 🌐 |
| GET | `/shipping/available` | 🌐 |

### Customer — requires `Authorization: Bearer`
| Method | Path | Tier |
|--------|------|------|
| POST·GET | `/addresses` | 🔒 |
| GET·PATCH·DELETE | `/addresses/:id` | 🔒 |
| POST | `/addresses/:id/default` | 🔒 |
| GET·DELETE | `/wishlist` | 🔒 |
| POST | `/wishlist/items` | 🔒 |
| DELETE | `/wishlist/items/:id` | 🔒 |
| GET | `/wishlist/has/:variantID` | 🔒 |
| GET | `/wallet` | 🔒 |
| POST | `/wallet/withdraw` | 🔒 |
| GET | `/wallet/transactions` | 🔒 |
| POST·GET | `/orders` | 🔒 |
| GET | `/orders/:id` | 🔒 |
| POST | `/orders/:id/cancel` | 🔒 |
| POST | `/reviews` | 🔒 |
| PATCH·DELETE | `/reviews/:id` | 🔒 |
| POST | `/reviews/:id/react` | 🔒 |
| GET·POST | `/reviews/:id/images` | 🔒 |
| GET | `/recommendations/for-you` | 🔒 |
| POST | `/recommendations/interactions` | 🔒 |
| GET·POST | `/recommendations/profile` · `/recommendations/profile/recompute` | 🔒 |

### Admin — `/admin` (requires role `admin`)
| Method | Path | Tier |
|--------|------|------|
| GET | `/admin/roles` | 🛡️ |
| GET·POST | `/admin/users` | 🛡️ |
| GET·PATCH·DELETE | `/admin/users/:userID` | 🛡️ |
| GET | `/admin/users/:userID/audit` | 🛡️ |
| GET·POST·PATCH·DELETE | `/admin/products` … | 🛡️ |
| POST·PUT | `/admin/products/aggregate` · `/admin/products/:id/aggregate` | 🛡️ |
| POST/PUT/DELETE | `/admin/products/:id/tags` | 🛡️ |
| POST | `/admin/products/:id/variants` | 🛡️ |
| POST | `/admin/products/:id/images/url` | 🛡️ |
| POST | `/admin/uploads` | 🛡️ |
| POST | `/admin/uploads/:ownerType/:ownerID/:role` | 🛡️ |
| PATCH·DELETE | `/admin/variants/:id` | 🛡️ |
| POST·PUT | `/admin/variants/:id/options` | 🛡️ |
| GET·POST·PATCH·DELETE | `/admin/option-types` · `/admin/option-values` … | 🛡️ |
| POST·PATCH·DELETE | `/admin/categories` … | 🛡️ |
| POST·PATCH·DELETE | `/admin/brands` · `/admin/tags` … | 🛡️ |
| GET | `/admin/orders` · `/admin/orders/:id` | 🛡️ |
| PATCH | `/admin/orders/:id/status` | 🛡️ |
| GET | `/admin/reviews` | 🛡️ |
| PATCH | `/admin/reviews/:id/status` | 🛡️ |
| POST·PATCH·DELETE | `/admin/shipping/...` | 🛡️ |
| GET | `/admin/payments` … | 🛡️ |
| GET·POST·PATCH | `/admin/inventory/...` | 🛡️ |
| POST·GET·PATCH·DELETE | `/admin/blogs` · `/admin/blog-categories` … | 🛡️ |
| GET·POST·PATCH·DELETE | `/admin/recipes` · `/admin/recipes/:id` | 🛡️ |
| GET·POST·PUT·PATCH·DELETE | `/admin/hero-slides` · `/admin/hero-slides/order` · `/admin/hero-slides/:id` | 🛡️ |
| GET·PUT | `/admin/settings` | 🛡️ |
| GET | `/admin/analytics/...` | 🛡️ |

> The full, exact list of admin routes is documented on each resource page.
