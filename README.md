# StackShop – Bug Fixes and Improvements
Submitted by: Surya Theja Dokka
## Overview

This project is a sample eCommerce application built with Next.js that includes:

- Product list page
- Product search and filtering
- Product detail page

The original application contained several issues across multiple areas including user experience problems, functionality bugs, performance issues, and architectural problems.

The goal of this assignment was to review the application, identify problems, fix them, and document the reasoning behind each change.

The fixes focused on improving:

- application stability
- filtering behavior
- routing architecture
- search performance
- product discoverability
- UI consistency
- overall application polish

## Getting Started

Install dependencies and start the development server:

```bash
yarn install
yarn dev
```
Then open the application in your browser at: http://localhost:3000


## Bugs Identified and Fixed

### Bug 1 – Subcategory dropdown showed all subcategories regardless of selected category

When selecting a category, the subcategory dropdown would populate with subcategories from every category in the dataset instead of just the relevant ones. Selecting "Tablets" would show options like "Beauty Products" and "Headset" alongside the actual tablet subcategories.

The API call to fetch subcategories was missing the `?category=` query parameter — it was just calling `/api/subcategories` with nothing attached. The server-side filtering logic was already correct, the parameter just wasn't being passed from the client.

Fixed by passing the selected category in the request:
```ts
fetch(`/api/subcategories?category=${encodeURIComponent(selectedCategory)}`)
```

One line change. No server-side work needed since the filtering was already there.


### Bug 2 – Product detail page crashed and images failed to load for some products

**What bugs/issues were identified**

Clicking certain products (for example items under the **Desktops** category) caused the product detail page to fail. Two issues were discovered during investigation:

1. The page crashed with the error:

```
TypeError: Cannot read properties of null
```

Some products in the dataset contain `null` values for `imageUrls` and `featureBullets`. The component assumed these fields were always arrays and accessed properties such as `.length` and array indexes directly. When the value was `null`, the page threw a runtime error.

2. After fixing the crash, product images for some desktop products still did not render. Next.js blocked the images because the domain was not included in the allowed image host configuration.

The existing `next.config.ts` only allowed:

```
m.media-amazon.com
```

However some products used a different Amazon CDN host:

```
images-na.ssl-images-amazon.com
```

Next.js blocks images from unconfigured domains for security reasons.

---

**How the issue was fixed**

1. Added optional chaining to safely handle missing product data:

```ts
product.featureBullets?.length
product.imageUrls?.[selectedImage]
product.imageUrls?.length
```

This prevents runtime crashes when fields are `null`.

2. Updated `next.config.ts` to allow the second Amazon image CDN used in the dataset by adding it to `remotePatterns`.

---

**Why this approach was chosen**

Optional chaining provides a simple and safe way to handle optional product fields without introducing complex conditional logic. Updating the allowed image hosts follows the recommended Next.js approach for securely loading external images.

---

**Improvements or enhancements**

The product detail page now gracefully handles incomplete product data and reliably renders images from all supported Amazon CDN sources, preventing runtime crashes and improving the overall robustness of the UI.

### Bug 3 – Full product JSON was passed through the URL (insecure + fragile routing)

**What bugs/issues were identified**

Clicking a product navigated to a URL like:

```
/product?product={"title":"...","imageUrls":[...],"featureBullets":[...]}
```

The entire product object was serialized into a query parameter. This created multiple issues:

- URLs became very large (often ~2KB+)
- Product data was exposed in browser history and could appear in logs
- The product detail page trusted whatever JSON was in the URL, meaning the UI could be manipulated by editing the query string
- The data could become stale and was not guaranteed to match the real product source

The application already had an API endpoint available to fetch product data by identifier (`/api/products/[sku]`), but it was not being used.

---

**How the issue was fixed**

- Implemented a SKU-based product detail route at:

`app/product/[sku]/page.tsx`

- Updated product links on the list page from passing JSON in the query string to a clean URL:

`/product/${product.stacklineSku}`

- Replaced `useSearchParams + JSON.parse(...)` with `useParams + fetch(/api/products/${sku})` so the page fetches the product from the API using the SKU.

---

**Why this approach was chosen**

- Uses stable, canonical routing (`/product/{sku}`) instead of embedding state in the URL
- Avoids exposing large payloads in query strings
- Ensures the detail page always renders fresh, authoritative data from the API
- Keeps the change minimal by using an existing API endpoint and reusing the existing UI

---

**Improvements or enhancements**

The product detail URLs are now clean and shareable, the page no longer trusts user-controlled JSON input, and product information stays consistent with the API source of truth.


### Bug 4 – Switching categories left a stale subcategory filter applied

**What bugs/issues were identified**

When a user selected a **category**, then chose a **subcategory**, and later switched to a different category, the page often showed **"No products found."**

This happened because the previously selected subcategory remained active even after changing the category. The combination of the new category and the old subcategory often produced a filter that matched no products.

The `useEffect` responsible for loading subcategories only cleared the subcategory when the category was completely deselected, not when switching between categories.

---

**How the issue was fixed**

The subcategory state is now reset whenever the category changes by adding:

```ts
setSelectedSubCategory(undefined);
```

at the beginning of the category change effect.

This ensures that whenever a new category is selected, any previously selected subcategory is cleared.

---

**Why this approach was chosen**

Resetting the dependent filter state ensures the UI remains consistent and prevents invalid category–subcategory combinations. It also keeps the fix minimal by modifying the existing category change logic rather than introducing additional complexity.

---

**Improvements or enhancements**

Filtering behavior is now predictable. Changing categories automatically clears incompatible subcategory selections, preventing confusing "No products found" states and improving the overall user experience.

### Bug 5 – Search triggered an API request on every keystroke

**What bugs/issues were identified**

The search input triggered a product fetch on every character typed. For example, typing **"gaming mouse"** would send 11 separate API requests — one for each character input.

Most of these requests were unnecessary because they were immediately replaced by the next request while the user was still typing. This created excessive network traffic and unnecessary load on the API.

---

**How the issue was fixed**

A **300ms debounce** was added around the fetch logic using `setTimeout` and `clearTimeout` inside the `useEffect`.

```ts
const timer = setTimeout(() => {
  fetch(`/api/products?${params}`)
    .then((res) => res.json())
    .then((data) => {
      setProducts(data.products);
      setLoading(false);
    });
}, 300);

return () => clearTimeout(timer);
```

Each time the user types a new character, the previous timer is cancelled. The request only runs after the user pauses typing for 300ms.

---

**Why this approach was chosen**

Debouncing is a common frontend performance optimization for search inputs. It significantly reduces unnecessary API calls while keeping the interface responsive.

The solution required minimal changes to the existing logic and integrates cleanly with the existing `useEffect` that handles product fetching.

---

**Improvements or enhancements**

Search requests are now more efficient and predictable. The application avoids redundant API calls while still providing responsive search behavior for users.

### Bug 6 – Category and subcategory dropdowns did not reset visually after clearing filters

**What bugs/issues were identified**

When the **Clear Filters** button was clicked, the filter state (`search`, `selectedCategory`, `selectedSubCategory`) was reset internally, but the dropdown UI still displayed the previously selected category and subcategory.

This created a mismatch between the actual filter state and what the user saw in the UI, making it appear as if filters were still applied even though they had been cleared.

Additionally, clicking the **StackShop logo** in the header did not reset filters or return the page to its default state.

---

**How the issue was fixed**

A `key` prop was added to both dropdown `<Select>` components:

```tsx
<Select
  key={selectedCategory ?? "all-categories"}
  value={selectedCategory}
  onValueChange={(value) => setSelectedCategory(value || undefined)}
>
```

```tsx
<Select
  key={selectedSubCategory ?? "all-subcategories"}
  value={selectedSubCategory}
  onValueChange={(value) =>
    setSelectedSubCategory(value || undefined)
  }
>
```

The `key` forces React to remount the dropdown components whenever the filter state resets, ensuring the UI reflects the updated state.

The **StackShop logo** was also wrapped in a `Link` with an `onClick` handler that clears all filters.

---

**Why this approach was chosen**

Forcing a remount using the `key` ensures the dropdown components reset completely without introducing additional state management complexity. Resetting filters on logo click provides a simple and intuitive way for users to return to the default product list.

---

**Improvements or enhancements**

- Dropdown selections now reset correctly when filters are cleared  
- Clicking the **StackShop logo** now clears all filters and returns the page to its default state

### Bug 7 – Only the first 20 of 500 products were reachable

**What bugs/issues were identified**

The product list hardcoded `limit=20` when requesting products from the API. As a result, the application only ever displayed the first 20 products in the dataset, even though the API contained **500 total products**.

The UI displayed the message:

```
Showing 20 products
```

which made it appear as though the result was filtered rather than capped. In reality, the remaining **480 products were completely inaccessible** through the interface.

The API already returned a `total` count and supported an `offset` parameter for pagination, but these were not being used by the client.

---

**How the issue was fixed**

Pagination support was implemented on the client side by:

- Adding `offset` and `total` state
- Passing `limit` and `offset` to the products API request
- Updating the result label to show the correct range of visible products
- Adding **Previous** and **Next** navigation buttons
- Resetting `offset` to `0` whenever filters or search change

Example of the updated API request:

```ts
params.append("limit", String(limit));
params.append("offset", String(offset));
```

The UI now displays:

```
Showing X–Y of Z products
```

along with page navigation controls.

---

**Why this approach was chosen**

The backend API already supported pagination through `limit` and `offset`, so the most efficient solution was to connect the existing API capability to the client UI rather than introducing a new data fetching pattern.

This approach keeps the implementation simple while enabling users to browse the full dataset.

---

**Improvements or enhancements**

Users can now browse the entire product catalog instead of being limited to the first 20 items. The interface clearly communicates the current range of results and provides navigation controls to move between pages.

### Bug 8 – Default Next.js metadata still used the template title

**What bugs/issues were identified**

The browser tab title and page metadata still used the default values generated by the Next.js project template:

```
title: "Create Next App"
description: "Generated by create next app"
```

This did not reflect the actual application branding and made the site appear as if the default scaffold configuration had not been updated.

---

**How the issue was fixed**

The metadata in `app/layout.tsx` was updated to reflect the application name and purpose:

```ts
export const metadata: Metadata = {
  title: "StackShop",
  description: "Browse and search products across hundreds of categories",
};
```

---

**Why this approach was chosen**

Next.js manages page metadata through the `metadata` configuration in the root layout. Updating this configuration ensures the correct title and description are consistently applied across the application.

---

**Improvements or enhancements**

The browser tab now correctly displays **StackShop**, improving branding consistency and making the application appear more polished and production-ready.

## Summary of Changes

This assignment focused on identifying and resolving issues affecting functionality, user experience, performance, and application architecture.

The following improvements were implemented:

- Fixed incorrect subcategory filtering behavior
- Prevented product page crashes caused by incomplete product data
- Allowed additional Amazon CDN host used by the dataset for product images
- Replaced insecure JSON query routing with SKU-based dynamic routing
- Fixed stale subcategory filters when switching categories
- Added debounce to search to prevent excessive API requests
- Ensured dropdown filters reset correctly in the UI
- Implemented pagination so users can browse the full product catalog
- Updated default Next.js metadata to reflect the application branding

These changes improve the reliability, usability, and maintainability of the application while keeping the implementation minimal and focused.

---
