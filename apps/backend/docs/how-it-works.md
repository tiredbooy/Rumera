# How Rumera Works — A Plain-Language Guide

> A guide for **everyone** — store owners, marketers, support staff, investors.
> No technical background needed. If you can picture a physical shop, you can
> understand how Rumera works.
>
> _(Need this in Persian? It can be translated on request.)_
>
> **Engineers:** pair this with [architecture.md](./architecture.md) and
> [domain-map.md](./architecture/domain-map.md). Dual-doc:
> [`docs/DOCUMENTATION-DUAL-TRACK.md`](../../../docs/DOCUMENTATION-DUAL-TRACK.md).

---

## 0. How the “back office” is organised (2026)

The Backend is not one giant pile of code. Each **business area** (products,
cart, orders, payments, wallet, loyalty, …) is a **feature package** that owns
its own routes and rules. A thin **router** only decides:

- **Public door** — anyone (browse, login, payment webhook)
- **Customer door** — logged-in shoppers (cart, checkout, account)
- **Admin door** — staff with roles and permissions (catalogue, stock, refunds)

Think of each feature package as a **department** in the shop. Departments talk
through the manager (bootstrap wiring), not by raiding each other’s filing cabinets.

---

## 1. The big picture

Rumera is an **online store**. Think of it as a real shop, but on the internet.
A real shop has a few parts working together:

| In a real shop… | In Rumera… | What it does |
|---|---|---|
| The shop front & shelves | **The Storefront** (website) | What customers see and click |
| The staff & back office | **The Backend** (the "brain") | Makes all the decisions |
| The filing cabinets | **The Databases** | Remembers everything (products, orders, customers) |
| A super-fast librarian | **Search** | Finds products instantly when someone types |
| A sticky-note board | **The Cache** | Keeps popular answers ready so pages load fast |

The customer only ever talks to the **Storefront**. The Storefront quietly asks
the **Backend** for everything it needs. The customer never sees the back office —
just like in a real shop you don't walk into the stockroom.

```
   Customer's phone / laptop
            │  "show me the products"
            ▼
        STOREFRONT  (the website)
            │  asks politely, behind the scenes
            ▼
         BACKEND  (the brain / staff)
            │            │            │
            ▼            ▼            ▼
        DATABASE      SEARCH        CACHE
       (the memory) (the finder)  (the fast notes)
```

---

## 2. The customer's journey

Here is what happens, step by step, when someone shops on Rumera. For each step
there's what the **customer sees** and what happens **behind the scenes**.

### a) Browsing the store
- **Customer sees:** the home page, product categories, featured items.
- **Behind the scenes:** the Storefront asks the Backend "what's on the home
  page?" The Backend checks its fast notes (cache); if the answer is ready it
  replies instantly, otherwise it looks in the database and saves the answer for
  next time.

### b) Searching for something
- **Customer sees:** they type "honey" and matching products appear as they type.
- **Behind the scenes:** the super-fast librarian (Search) is asked. It was
  trained on all the products beforehand, so it can find matches in a blink —
  even with small typos.

### c) Looking at a product
- **Customer sees:** photos, price, description, reviews, "add to cart".
- **Behind the scenes:** the Backend gathers the product details, its variants
  (e.g. sizes/weights), stock level, and customer reviews, and hands them over.

### d) Adding to the cart
- **Customer sees:** the item appears in their basket.
- **Behind the scenes:** the Backend remembers the basket for that person. If
  they're logged in, the basket follows them across devices.

### e) Creating an account / logging in
- **Customer sees:** a sign-up or login form.
- **Behind the scenes:** see **section 4 (Accounts & safety)** below. Short
  version: their password is scrambled so that **even we can't read it**, and
  they get a secure "pass" that proves who they are for the rest of the visit.

### f) Checkout & payment
- **Customer sees:** they confirm address, choose shipping, pay, and get an
  order confirmation.
- **Behind the scenes:** the Backend double-checks stock and prices (so nothing
  is oversold), applies any coupon, talks to the payment provider, and records
  the order. Money handling has extra safety so a customer is **never charged
  twice**, even if they tap "pay" twice or the internet hiccups.

### g) After the order
- **Customer sees:** order history, status updates, and can leave a review.
- **Behind the scenes:** the order moves through stages (paid → being prepared →
  shipped → delivered). Staff update it from the admin side (section 5).

---

## 3. More than a shop: content & recommendations

Rumera isn't only a checkout. It also has:

- **Recipes** — cooking/usage ideas that feature the products. Great for
  attracting visitors from search engines and inspiring purchases.
- **Journal** — a blog/magazine with articles and stories about the brand.
- **Recommendations** — "you might also like…". The system quietly learns from
  what people view and buy, and suggests relevant products. A purchase counts
  far more than a glance, so suggestions reflect real interest.

All of this is designed so that **search engines like Google can read and
recommend the site**, which brings in free visitors.

---

## 4. Accounts & safety (in plain words)

A few things people always worry about — handled like this:

- **Passwords:** when someone sets a password, it is immediately **scrambled
  one-way**. We store only the scramble. Nobody — not even staff — can read the
  original. When they log in, we scramble what they typed and compare the
  scrambles. (This is why "forgot password" sends a reset link instead of
  emailing the old password — the old one literally can't be looked up.)

- **Staying logged in:** after login the customer gets a temporary **digital
  pass**. It expires quickly for safety, but renews automatically in the
  background so they're not constantly asked to log in again.

- **"We won't say which was wrong":** if a login fails, the message is always
  "email or password is incorrect" — never "this email doesn't exist." That
  prevents strangers from discovering who has an account.

- **Roles:** a regular **customer** can only touch their own cart, orders and
  profile. **Staff/admins** have extra powers (managing products, viewing
  orders). A customer can never give themselves admin powers.

---

## 5. The staff (admin) side

Behind the public shop there's an **admin area** for the team:

- Add/edit products, prices, photos, categories, brands, and stock.
- See and manage orders (mark as shipped, handle refunds).
- Manage coupons, shipping options, and content (recipes, journal).
- See analytics — what's selling, what people search for, traffic trends.

Customers never see this. It's the digital version of the back office.

---

## 6. Why it's fast and reliable

A few quiet helpers keep the experience smooth:

- **The fast-notes board (cache):** popular pages are kept ready, so the store
  feels instant and the database isn't overworked.
- **The finder (search):** dedicated to lightning-fast, typo-tolerant search.
- **Safety on money & stock:** prices and stock are re-checked at the moment of
  purchase, and payments are protected against accidental double-charges.
- **Self-healing:** if a part restarts, it picks up where it left off, and the
  system regularly tidies up after itself.

---

## 7. Two "modes": building vs. live

The same store runs in two environments:

- **Development ("dev"):** a practice copy on a developer's computer. Changes
  appear instantly so the team can build and test safely. Nothing here is real.
- **Production ("prod"):** the real, live store that customers use. It's locked
  down, optimized for speed, and its secrets (passwords, keys) are protected.

Switching the whole system on is essentially **one command** for each mode — the
team doesn't assemble the pieces by hand every time.

---

## 8. Mini-glossary

| Word you might hear | What it really means |
|---|---|
| **Frontend / Storefront** | The website customers see and click. |
| **Backend / API** | The "brain" that makes decisions; customers never see it. |
| **Database** | The long-term memory (products, orders, customers). |
| **Cache** | Short-term fast notes for popular answers. |
| **Search index** | The finder's pre-built catalogue for instant search. |
| **Token / digital pass** | Proof of who you are after logging in. |
| **Endpoint / API call** | One specific question the Storefront asks the Backend. |
| **Deploy** | Publishing a new version of the store. |
| **Environment (dev/prod)** | Practice copy vs. the real live store. |

---

### Where to go next

- Want the technical version? Start at the [documentation home](./README.md).
- How a request actually travels through the system: [Architecture](./architecture.md).
- The exact list of things the Storefront can ask the Backend:
  [API Reference](./api/README.md).
