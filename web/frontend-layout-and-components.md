# HideAuto Script Store — Page Layout & Component Specification

> Frontend-only UX and information architecture specification for a store that sells downloadable scripts.
> This document complements `design-frontend.md`; the accepted **Industry strict** design system remains the visual source of truth.

**Status:** Proposed  
**Audience:** Frontend developers, designers, QA engineers, and AI coding assistants  
**Scope:** Customer-facing storefront, customer workspace, authentication screens, and frontend behavior  
**Out of scope:** Backend implementation, database schema, payment-provider internals, and the admin dashboard

---

## 1. Product Experience Goals

- Help users answer four questions quickly:
  - What problem does this script solve?
  - Is it compatible with my environment?
  - Can I trust and maintain it?
  - What exactly do I receive after purchase?
- Optimize the primary journey: **discover → evaluate → purchase → install → update**.
- Prefer verifiable product data over promotional copy.
- Keep purchase actions visible without hiding compatibility, license, or refund information.
- Let returning customers reach downloads and license information within two interactions.
- Preserve the Industry design language defined in `design-frontend.md`.

### UX success indicators

- Search and filters remain usable with hundreds of scripts.
- Product comparison does not require opening many browser tabs.
- Product Details shows a clear starting price and a contextual `Contact seller` action before any private buyer-seller conversation.
- A script inquiry has an obvious next step: open the seller conversation or relevant documentation.
- Empty, loading, error, and offline states are designed—not left to implementation defaults.

---

## 2. Information Architecture

```text
Storefront
├── Home                         /
├── Browse scripts               /scripts
│   ├── Category                 /scripts?category={slug}
│   ├── Search                   /scripts?q={query}
│   └── Script details           /scripts/{slug}
├── Collections                  /collections/{slug}
├── Contact seller               /contact
├── Documentation index          /docs
├── Script documentation         /docs/{scriptSlug}/{...path}
├── Support                      /support
├── Legal
│   ├── License terms            /legal/licenses
│   ├── Refund policy            /legal/refunds
│   ├── Privacy                  /legal/privacy
│   └── Terms                    /legal/terms
├── Authentication
│   ├── Sign in                  /auth/sign-in
│   ├── Register                 /auth/register
│   ├── Forgot password          /auth/forgot-password
│   └── Reset password           /auth/reset-password
└── Customer workspace           /account
    ├── Library                  /account/library
    ├── Orders                   /account/orders
    ├── Order details            /account/orders/{orderId}
    ├── Licenses                 /account/licenses
    ├── Wishlist                 /account/wishlist
    ├── Support requests         /account/support
    ├── Profile                  /account/profile
    └── Security                 /account/security
```

### Primary navigation

- **Scripts:** main catalog entry.
- **Collections:** curated groups such as “Browser Automation” or “Starter Kits.”
- **Docs:** public setup and API documentation.
- **Support:** self-service help followed by contact options.
- **Search:** persistent desktop control; full-width command sheet on mobile.
- **Account:** sign-in action or customer menu.
- **Contact seller:** visible labelled entry point; no cart count or checkout action.
- **Language switcher:** persistent `EN` / `VI` control in the header. It must
  use visible text (not flags alone), retain the current route and query state,
  and announce the selected language to assistive technology.

---

## 3. Global Page Shell

### 3.1 Storefront shell

```text
┌──────────────────────────────────────────────────────────────┐
│ Utility bar: release/support notice (optional, dismissible) │
├──────────────────────────────────────────────────────────────┤
│ Logo │ Scripts │ Collections │ Docs │ Search │ Theme │ Contact │
├──────────────────────────────────────────────────────────────┤
│ Breadcrumbs / page context                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Main page content                                            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Footer: catalog │ resources │ policies │ status │ copyright │
└──────────────────────────────────────────────────────────────┘
```

- Header is sticky when useful, with a hairline bottom border and no shadow.
- Skip link is the first focusable element: `Skip to main content`.
- Utility bar appears only for actionable information, such as a breaking compatibility change.
- Breadcrumbs appear on detail, documentation, checkout, and account subpages.
- Maximum content width: `1280px`; product reading column: `720–780px`.
- Page gutters: `16px` mobile, `24px` tablet, `32px` desktop.

### 3.2 Customer workspace shell

- Desktop: left navigation rail (`224px`) plus flexible content column.
- Mobile: account section selector above the content; do not hide navigation in an unlabelled icon.
- Display customer identity, current section, and sign-out action distinctly.
- Keep Store and Account contexts visually related but navigationally explicit.

### 3.3 Documentation shell

- Desktop: documentation tree, article, and on-page table of contents.
- Tablet: collapsible documentation tree plus article.
- Mobile: article first; tree and table of contents open as labelled sheets.
- Keep version selector visible near the script name.
- Code blocks support copy, wrap/scroll behavior, language label, and success feedback.

---

## 4. Page Specifications

## 4.1 Home — `/`

**Purpose:** Establish trust and move users into relevant scripts quickly.

### Section order

1. **Compact hero**
   - Section label: `SCRIPT MARKETPLACE`.
   - One outcome-focused heading and a short supporting sentence.
   - Primary action: `Browse scripts`.
   - Secondary action: `View documentation`.
   - Search input with example placeholder: `Search by task, platform, or runtime`.
2. **Script discovery rails**
   - Compact image-backed listings grouped as Top views, Newest, Most watched, and Recently updated.
   - Each rail has a `View all` deep link to the dedicated catalog.
3. **Browse by use case**
   - Examples: Automation, Data Extraction, DevOps, Productivity, E-commerce.
   - Each item includes script count and a concise outcome.
4. **Advertisement placeholder**
   - Clearly labelled reserved slot between discovery rails; no third-party code until campaigns are admin-managed.
5. **How delivery works**
   - Three steps: compare, contact seller, agree delivery privately.
6. **Support and documentation callout**
   - Link to installation guides, license FAQ, and support policy.

### UX rules

- Do not use a full-screen marketing hero or auto-playing media.
- Discovery rails may use different headings only when their sort/filter semantics are distinct.
- Preserve the search query when navigating from Home to the catalog.

---

## 4.2 Script Catalog — `/scripts`

**Purpose:** Help users narrow a large inventory without losing context.

### Desktop layout

```text
┌──────────────────────────────────────────────────────────────┐
│ SCRIPTS / Catalog title / result count                       │
│ Search field                                      Sort menu  │
├─────────────────┬────────────────────────────────────────────┤
│ Filter groups   │ Active filter chips + Clear all           │
│ - Category      │ Results grid/list                          │
│ - Platform      │                                            │
│ - Runtime       │                                            │
│ - License       │                                            │
│ - Price         │                                            │
│ - Updated       │                                            │
└─────────────────┴────────────────────────────────────────────┘
```

### Core components

- `CatalogSearch`
- `FilterSidebar` / `FilterSheet`
- `ActiveFilterBar`
- `SortSelect`
- `ViewToggle` for grid or compact list
- `ScriptCard`
- `ResultsSummary`
- `Pagination` or explicit `Load more`

### Behavior

- Store search, filter, sort, page, and view in URL query parameters.
- Apply desktop filters immediately; use `Show {n} results` in the mobile filter sheet.
- Show selected filters as removable chips above results.
- Announce updated result counts to assistive technology without moving focus.
- Keep a stable result position while non-blocking feedback appears.
- Use explicit pagination for shareable browsing; preserve scroll position on back navigation.
- Zero results state:
  - Explain which filters caused the constraint.
  - Offer `Clear all filters`.
  - Suggest corrected terms or adjacent categories.

### Script card content priority

1. Script name and short outcome.
2. Starting price and license model.
3. Compatibility chips: runtime/platform.
4. Version and last updated date.
5. Trust signals: rating count, documentation, or verified publisher.
6. Actions: `View details`; `Contact seller` is available on detail only.

Never put `Add to cart`, checkout, or payment actions on a card.

---

## 4.3 Script Details — `/scripts/{slug}`

**Purpose:** Provide enough evidence for a confident purchase decision.

### Desktop layout

```text
┌───────────────────────────────────┬──────────────────────────┐
│ Breadcrumbs                       │ Purchase panel           │
│ Name, outcome, badges             │ - Price / license        │
│ Compatibility + update metadata   │ - Included items         │
│ Media preview / demo              │ - Support period         │
│                                   │ - Add to cart            │
│ Tabs/anchors: Overview, Features, │ - Wishlist               │
│ Requirements, Changelog, Reviews  │ - Refund/license links   │
└───────────────────────────────────┴──────────────────────────┘
```

### Required content

- Product title, current version, publisher, last updated date, and maintenance status.
- One-sentence outcome followed by a factual description.
- Supported OS, runtime/version, dependencies, required accounts, and known limitations.
- License selector with a short explanation for each option.
- Exact deliverables: source files, compiled package, documentation, examples, update period.
- Screenshots or demo with meaningful captions; opening media must not reset reading position.
- Features and non-features to set expectations clearly.
- Installation preview with link to full documentation.
- Versioned changelog with release dates.
- Rating distribution and verified-purchase reviews when available.
- Related scripts based on use case, not merely price.

### Purchase panel rules

- Sticky only while it fits in the viewport; never obscure footer or content.
- Recalculate price immediately after license selection.
- Display taxes as estimated or included; do not defer price disclosure to the last step.
- Disable purchase only with a nearby reason, for example `Select a license to continue`.
- After adding: show inline confirmation plus `View cart` and `Continue browsing`.

### Mobile layout

- Product summary and compatibility appear before media.
- Purchase panel becomes an in-flow section.
- Optional sticky bottom action shows selected price and `Add to cart`; it must respect safe-area insets.
- Anchor navigation becomes a horizontally scrollable labelled list.

---

## 4.4 Collection — `/collections/{slug}`

- Collection title, practical use case, curator note, and updated date.
- Optional required ordering, for example `Start here → Extend → Deploy`.
- Product cards use the same catalog component and metadata hierarchy.
- A bundle must show individual prices, bundle price, savings, duplicate ownership handling, and license scope.

---

## 4.5 Cart — `/cart`

**Purpose:** Review products, licenses, and totals without surprises.

### Layout

- Main column: cart line items.
- Summary column: subtotal, discount, estimated tax, and total.
- Each item shows version, selected license, quantity only when meaningful, update/support period, and price.
- License changes occur inline and update totals immediately.
- Removal uses an undo toast; do not require a modal for a single recoverable item removal.
- Promo code entry is collapsed behind `Add a promo code`.
- Primary action: `Proceed to checkout`.
- Secondary action: `Continue browsing`.

### States

- Empty cart: explain that saved items remain in Wishlist and link to popular categories.
- Price changed: identify old and new values before checkout.
- Already owned: show ownership status and explain renewal/upgrade behavior.
- Conflict: explain incompatible license combinations at item level and in the summary.

---

## 4.6 Checkout — `/checkout`

**Purpose:** Complete payment with minimal input and maximum clarity.

### Recommended single-page structure

1. Contact information.
2. Billing details and business tax fields when applicable.
3. Payment method.
4. Final order review and license acknowledgement.
5. `Pay {formattedTotal}` action.

### Layout and behavior

- Desktop: form (`minmax(0, 1fr)`) plus sticky order summary (`360–400px`).
- Mobile: order summary appears collapsed near the top and fully expanded before payment.
- Support guest checkout if product policy allows it; offer account creation after purchase.
- Validate fields on blur and submission; preserve entered values after errors.
- Put errors beside fields and provide an error summary linking to invalid fields.
- Disable the final button only while submitting; show progress text such as `Processing payment…`.
- Prevent duplicate submission, but allow a safe retry after a failed request.
- Never use a countdown timer or preselected marketing consent.

---

## 4.7 Purchase Success — `/checkout/success`

**Purpose:** Confirm ownership and guide the first successful use.

- Confirmation heading and order reference.
- Delivery status for every purchased script.
- Primary action: `Open my library`.
- Per-script quick actions: `Download`, `Copy install command`, `Read setup guide`.
- Account creation prompt for guest customers without blocking access instructions.
- Receipt delivery status and `Download invoice` action.
- Support link that includes the order reference when opened.
- If payment is pending, use a pending page—not a misleading success state.

---

## 4.8 Authentication Pages — `/auth/*`

- Centered form with a maximum width of `420px`; keep the global logo and support link.
- Sign-in supports email/password plus configured identity providers.
- Preserve the intended destination via a validated `returnTo` parameter.
- Password input includes show/hide control, Caps Lock feedback, and password-manager-friendly attributes.
- Registration shows password requirements before submission.
- Use a neutral response for forgot-password requests to avoid account enumeration.
- Put terms and privacy acknowledgement next to the registration action.

---

## 4.9 Customer Library — `/account/library`

**Purpose:** Make owned products easy to install, update, and manage.

### Layout

- Header: `LIBRARY`, title, owned item count, and search.
- Filters: status, runtime, category, and update availability.
- Default list ordering: updates available, recently purchased, then alphabetical.
- Each `LibraryItem` contains:
  - Script name, current owned version, and latest version.
  - License status and relevant expiry/support date.
  - Primary action: `Download` or `Update`.
  - Secondary actions: install command, documentation, changelog, support.

### UX rules

- Version selector must distinguish stable and previous releases.
- Download action displays file type, version, size, and checksum access.
- Copy install command gives visible and screen-reader feedback.
- Expired support must not imply that an already licensed download is lost unless policy explicitly says so.
- Empty state links to catalog and explains where guest purchases can be linked.

---

## 4.10 Orders and Order Details — `/account/orders/*`

- Orders table/list: order ID, date, items, payment status, and total.
- Mobile rows become stacked labelled fields—not a horizontally clipped table.
- Filters: date range and payment status; search by order ID or script name.
- Order details include line items, billing summary, payment state, license selection, and invoice action.
- Support action carries order and product context automatically.

---

## 4.11 Licenses — `/account/licenses`

- Show product, license type, license key or masked identifier, activation count, status, and support/update period.
- Copying a key requires an explicit action and must not expose every key by default.
- Activation management uses a confirmation dialog only for consequential deactivation.
- Explain status labels such as `ACTIVE`, `EXPIRING`, `EXPIRED`, and `REVOKED` near the first occurrence.
- Place renewal or upgrade actions beside the affected license, with price and changed terms visible.

---

## 4.12 Wishlist — `/account/wishlist`

- Reuse the catalog card in a denser layout.
- Allow removal with undo and moving eligible items to cart.
- Show price or compatibility changes since the item was saved.
- Do not require sign-in to save locally; offer merge behavior after sign-in.

---

## 4.13 Documentation — `/docs/*`

- Documentation index supports search by script, task, and error message.
- Article header includes script, documentation version, article title, and last updated date.
- Article components:
  - Callout for requirement, warning, or version difference.
  - Ordered installation steps.
  - Code block with copy action.
  - Parameter table that becomes key-value cards on narrow screens.
  - Previous/next article navigation.
  - `Was this helpful?` feedback without interrupting reading.
- Keep store version and documentation version visibly linked.
- Broken or retired versions show a clear archival banner and migration link.

---

## 4.14 Support — `/support` and `/account/support`

- Start with documentation search and common issue categories.
- Contact form fields: script, installed version, environment, order reference, issue type, details, and attachments.
- Automatically prefill known account and purchase context; allow correction.
- State expected response time before submission.
- Confirmation page shows request ID, submitted details, and next steps.
- Never expose another customer's request through predictable URLs.

---

## 4.15 System Pages

### Not found

- State what was not found.
- Provide catalog search, Home, and Library links.
- For an old script URL, suggest its replacement when known.

### Error

- Use plain language, a retry action, and a support reference code.
- Preserve safe user inputs and cart state.
- Do not display stack traces or raw provider messages.

### Maintenance / offline

- Explain which features remain available.
- Keep cached documentation and owned download metadata accessible when feasible.
- Show last successful refresh time for stale content.

---

## 5. Shared Component Inventory

### Navigation and structure

- `StoreHeader`, `MobileNavigation`, `UtilityNotice`, `Breadcrumbs`, `PageHeader`, `SectionHeader`, `StoreFooter`
- `AccountSidebar`, `AccountSectionSelect`, `DocsSidebar`, `OnPageToc`
- `Container`, `Stack`, `Inline`, `Divider`, `BlueprintFrame`

### Commerce

- `Money`, `PriceBlock`, `LicenseSelector`, `CompatibilityList`, `ScriptCard`, `ScriptListItem`
- `CartLineItem`, `OrderSummary`, `PromoCodeForm`, `CheckoutSection`
- `OwnershipBadge`, `MaintenanceBadge`, `VersionBadge`, `RatingSummary`

### Discovery

- `GlobalSearch`, `SearchSuggestions`, `FilterGroup`, `FilterSheet`, `ActiveFilterChip`
- `SortSelect`, `ViewToggle`, `ResultsSummary`, `Pagination`, `CollectionCard`

### Feedback and state

- `InlineAlert`, `Callout`, `Toast`, `ProgressIndicator`, `Skeleton`, `EmptyState`, `ErrorState`
- `ConfirmDialog`, `Tooltip`, `Popover`, `StatusBadge`, `CopyButton`

### Forms

- `Field`, `TextInput`, `PasswordInput`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`
- `FieldHint`, `FieldError`, `ErrorSummary`, `SubmitButton`

### Media and documentation

- `MediaGallery`, `ImageViewer`, `CodeBlock`, `InstallCommand`, `ParameterTable`
- `Changelog`, `VersionSelector`, `ReviewList`, `ReviewSummary`

### Component contract rules

- Shared primitives contain styling and accessibility behavior, not feature-specific business rules.
- Feature components compose primitives and own domain language.
- Every interactive component supports keyboard, pointer, and touch input.
- Every asynchronous component defines idle, loading, success, empty, and error states.
- Avoid boolean-heavy APIs. Prefer explicit variants such as `tone="danger"` or `density="compact"`.
- Use semantic HTML before adding ARIA.

---

## 6. Responsive Behavior

| Range        | Layout behavior                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| `< 640px`    | Single column; mobile navigation; filter sheet; in-flow purchase panel; stacked order rows |
| `640–1023px` | Flexible two-column sections where content allows; collapsible side navigation             |
| `≥ 1024px`   | Persistent catalog/account sidebars; sticky purchase and summary panels                    |
| `≥ 1280px`   | Full content width; product detail reading column remains capped                           |

- Use content-driven CSS Grid and container queries for reusable cards.
- `ScriptCard` minimum useful width: `240px`; do not compress metadata below readability.
- Minimum touch target: `44 × 44px`, even if the visible icon is `16px`.
- Sticky elements must not overlap cookie notices, mobile action bars, or safe-area insets.
- Avoid hiding essential information on mobile; reorder or collapse it with a labelled disclosure.

## 6.1 Language and locale

- Support English (`en`) and Vietnamese (`vi`) across storefront, product,
  contact, and future account pages.
- Desktop: place a compact visible `EN / VI` switcher beside theme/account
  controls. Mobile: include the same labelled control in the navigation sheet.
- Store the selected locale in the route prefix (`/en/...`, `/vi/...`) or an
  equivalent framework-level locale mechanism; do not infer language from
  browser storage alone.
- Switching language preserves the current product, page, and safe query
  parameters. If an exact localized product is unavailable, keep the product
  title/version and show a clear language-availability notice.
- Use locale-aware formatting for prices, dates, counts, and input examples.
  Product versions, license keys, code blocks, commands, and IDs are never
  translated.
- Set `lang` on the document root for the active language. The selected option
  exposes its current state with `aria-current` or an equivalent semantic.
- All product-facing copy, validation text, empty/error states, metadata, and
  image alt text must have both English and Vietnamese translations.

### Translation implementation contract

- Store all reusable interface copy in `frontend/src/shared/i18n/messages/`:
  `en.ts` defines the canonical typed keys and every other locale implements
  exactly those keys.
- Use feature-scoped dot keys such as `catalog.filters.clearAll` and
  `advertising.campaignAvailable`; do not pass inline English/Vietnamese text
  pairs through component props for new work.
- Client components read copy through `useLocale().t(key, values)`. Server
  markup may use the `Message` component. Use `{placeholder}` values for
  dynamic text, for example `t('catalog.resultsFound', { count })`.
- New locale files must pass the message-catalog parity test. During
  development, a missing translation falls back to English and emits a
  warning; it is a release blocker until the locale message is provided.
- `TranslatedText` is legacy migration support only. Do not introduce new
  usages; migrate it feature-by-feature when changing existing UI.
- Translate visible labels, placeholders, `aria-label`, alt text, loading,
  empty, error, and success states. Do not translate IDs, versions, license
  keys, code, commands, or URLs.

---

## 7. Interaction and Feedback Rules

- Navigation feedback: destination changes immediately; show page-level skeleton only when necessary.
- Optimistic updates: suitable for wishlist and reversible cart removal; unsuitable for payment or license activation.
- Toasts confirm background/reversible actions; inline alerts explain issues requiring a decision.
- A toast must not be the only place where critical payment or download information appears.
- Focus moves into dialogs and returns to the invoking element on close.
- Use confirmation dialogs for destructive or consequential actions only.
- Search suggestions:
  - Debounce network requests.
  - Support arrow keys, Enter, and Escape.
  - Separate scripts, categories, and documentation results.
  - Show recent searches only on the user's device unless consented otherwise.
- Copy feedback uses `Copied` for approximately two seconds and an accessible live announcement.

---

## 8. Loading, Empty, and Error States

| Context       | Loading                                | Empty                          | Error                                      |
| ------------- | -------------------------------------- | ------------------------------ | ------------------------------------------ |
| Catalog       | Card skeletons matching final geometry | Clear filters and suggestions  | Retry results; keep filters/query          |
| Product       | Header/content skeleton; keep shell    | Not applicable                 | Explain unavailable/retired product        |
| Cart          | Line-item skeletons                    | Browse and wishlist actions    | Keep local cart; retry pricing             |
| Checkout      | Section-level indicator                | Redirect to cart               | Preserve fields; actionable retry          |
| Library       | Item skeletons                         | Browse scripts / link purchase | Keep cached ownership data visible         |
| Documentation | Article skeleton                       | Suggest index/search           | Retry and show cached version if available |

- Skeletons use minimal motion and respect `prefers-reduced-motion`.
- Do not replace the entire page when only one section is refreshing.
- Error messages follow: **what happened → what remains safe → what the user can do**.

Example: `Payment was not completed. Your cart is unchanged. Check the card details or choose another payment method.`

---

## 9. Accessibility Requirements

- Target WCAG 2.2 AA.
- Visible focus indicators meet contrast requirements on light and dark surfaces.
- Heading levels follow document order; visual size does not determine semantics.
- Price, status, and compatibility never rely on color alone.
- Form fields have persistent labels; placeholders are examples, not labels.
- Errors are associated with fields using `aria-describedby`; error summary receives focus after failed submission.
- Dialogs, sheets, menus, tabs, and comboboxes follow established keyboard patterns.
- Product media includes useful alternative text; decorative blueprint marks are hidden from assistive technology.
- Tables use headers and captions; responsive replacements keep visible field labels.
- Announce cart totals, search result counts, copy success, and asynchronous failures without excessive live-region noise.
- Support 200% browser zoom without loss of content or functionality.

---

## 10. Frontend Feature Organization

Organize by feature—not by technical layer.

```text
src/
├── app/                         # Next.js routes and route composition
│   ├── (store)/
│   ├── (auth)/
│   ├── account/
│   ├── checkout/
│   └── docs/
├── features/
│   ├── catalog/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── model/
│   │   └── index.ts
│   ├── product-details/
│   ├── cart/
│   ├── checkout/
│   ├── authentication/
│   ├── customer-library/
│   ├── orders/
│   ├── licenses/
│   ├── wishlist/
│   ├── documentation/
│   └── support/
├── shared/
│   ├── ui/                      # Design-system primitives
│   ├── layout/                  # Generic shells and layout primitives
│   ├── lib/                     # Framework-agnostic utilities
│   ├── hooks/                   # Truly cross-feature hooks
│   ├── types/                   # Shared transport/value types only
│   └── config/
└── styles/                      # Tokens, fonts, global styles
```

### Dependency boundaries

- Route files compose features; they should not contain complex UI or domain logic.
- A feature may import from `shared/*`.
- A feature must not import another feature's internal files.
- Cross-feature interaction uses a public feature API or route-level composition.
- Keep product-card behavior in `catalog`; keep purchase-panel behavior in `product-details`.
- Promote code to `shared` only after it is genuinely reused and domain-neutral.

Concrete example:

```ts
// Good: public API
import { ScriptCatalog } from "@/features/catalog";
import { PageHeader } from "@/shared/ui";

// Avoid: reaching into another feature
import { applyCatalogFilter } from "@/features/catalog/hooks/internal";
```

---

## 11. Frontend Data and URL State

- Server-render public catalog and product content for discovery, sharing, and fast first paint.
- Keep catalog query state in the URL: `?q=proxy&runtime=node&sort=updated&page=2`.
- Keep transient UI state local: open dialog, active gallery slide, password visibility.
- Keep cart and wishlist resilient across reloads; reconcile with the signed-in account when available.
- Never store payment credentials, complete license secrets, or sensitive identity data in browser persistence.
- Format money with `Intl.NumberFormat` and a provided currency; never concatenate currency symbols manually.
- Render dates with an explicit locale and timezone policy; show absolute dates for releases and purchases.
- Treat product version, documentation version, and purchased version as separate values.

---

## 12. Performance and Quality Targets

- Prioritize Core Web Vitals on Home, Catalog, and Product Details.
- Reserve image dimensions to prevent layout shift.
- Lazy-load below-the-fold media, reviews, and related products.
- Do not lazy-load the main product title, price, compatibility, or purchase action.
- Use responsive image sources and modern formats.
- Keep client components scoped to interactive islands; avoid turning whole pages into client components.
- Virtualize only genuinely large lists; standard catalog pagination is easier to navigate and restore.
- Test at minimum:
  - Keyboard-only navigation.
  - Screen-reader names for commerce actions.
  - 320px width and 200% zoom.
  - Slow network and failed requests.
  - Empty, single-item, and large-data states.
  - Light, dark, and reduced-motion preferences.

---

## 13. Analytics Events (Privacy-Conscious)

- `search_submitted`: query length, result count—not raw sensitive text.
- `filter_applied`: filter name and option.
- `script_viewed`: script ID and referring surface.
- `license_selected`: script ID and license type.
- `cart_item_added` / `cart_item_removed`.
- `checkout_started`, `checkout_validation_failed`, `purchase_completed`.
- `download_started`: script ID and version.
- `documentation_searched` and `support_started`.

Rules:

- Do not send license keys, payment fields, email addresses, support message bodies, or install commands.
- Analytics failure must never block navigation, purchase, or download.
- Event names describe user outcomes, not DOM implementation details.

---

## 14. Delivery Priority

### Phase 1 — Purchase path

- Global shell, Home, Catalog, Product Details, Cart, Checkout, Success.
- Authentication, Library, Orders, and Licenses.
- Core states, responsive layouts, keyboard access, and analytics.

### Phase 2 — Confidence and retention

- Documentation, Changelog, Reviews, Wishlist, Collections, and Support.
- Version management, invoice access, saved searches, and product comparison if validated by user research.

### Phase 3 — Optimization

- Personalized recommendations with transparent reasons.
- Bundle ownership handling, license upgrades, and advanced library filters.
- Performance tuning based on field data—not only lab scores.

---

## 15. Definition of Done for Every Page

- Matches `design-frontend.md` tokens and Industry strict component rules.
- Uses the correct storefront, account, or documentation shell.
- Works at mobile, tablet, and desktop widths.
- Supports keyboard navigation and visible focus.
- Includes loading, empty, error, and success behavior where applicable.
- Has no inaccessible icon-only action or unlabeled form control.
- Preserves user input and context across recoverable failures.
- Uses feature-owned components with explicit public boundaries.
- Has realistic test data, including long names and multiple currencies.
- Includes unit/component tests for behavior and an end-to-end test for the page's critical user task.
- When a page contains user-facing copy, verify both English and Vietnamese
  versions, including language switching while preserving route context.

# Home Discovery, Catalog Search, and Advertising Revision

This revision supersedes any conflicting Home, Catalog, metric, advertising, cart, checkout, or purchase guidance above.

## Home page composition

Remove the metrics / statistics section entirely. The Home page is a discovery page and must use this order:

1. Compact hero with the primary `Browse scripts` CTA.
2. `Top views` script rail.
3. Clearly labelled third-party advertisement placeholder (`home-after-top-views`).
4. `Newest` script rail.
5. `Most watched` script rail.
6. `Recently updated` script rail.
7. Browse-by-use-case content, delivery explanation, and support callout.
8. Optional clearly labelled footer advertisement placeholder (`home-footer`).

Every rail has a heading, a short optional description, a result count when available, and a `View all` link to `/scripts` with the relevant sort or filter pre-selected. Initial rails are `Top views`, `Newest`, `Most watched`, and `Recently updated`; the data model must permit additional rails without changing the component.

### Script rail presentation

Use the supplied reference as the visual direction: compact, information-dense listing rows instead of large standalone product cards. On wide screens, render a responsive three-column grid of compact `ScriptListItem` entries; each Home rail shows six products before its `View all` link. Each entry contains:

- A fixed thumbnail with an image, meaningful alt text, and reserved dimensions to prevent layout shift.
- Script title, seller name/verification state, rating or popularity count when supplied, and a short two-line description.
- Starting price when supplied; this is informative only and never creates a cart or checkout action.
- A clear entire-row link to the script detail page, with an accessible title.

Use a single column on small screens and preserve readable tap targets. Do not expose artificial popularity data as factual production data; fixture values must be explicitly demo content until a backend supplies them.

## Dedicated Script Catalog (`/scripts`)

`/scripts` is the canonical page for finding scripts. Home rail links must lead here, retaining their query or sort intent in the URL.

The catalog must provide a convenient search-and-filter workflow:

- Prominent search input at the top; search title, seller, tags, supported site/platform, and summary.
- Search query, filters, sorting, and pagination are URL state so links are shareable and browser Back/Forward works.
- Desktop: persistent filter sidebar. Mobile: a `Filters` button opening an accessible sheet with an explicit `Show results` action.
- Filters: category/use case, target platform, status, runtime, supported version, seller, license, starting-price range, and last-updated range.
- Show applied filters as removable chips, include `Clear all`, and show the current result count.
- Sorting: relevance (when searching), top views, newest, most watched, recently updated, and starting price. Default sorting is explicit.
- Debounce network-backed suggestions, but commit a stable query only on Enter, submit, or a deliberate selection. Keep keyboard navigation and focus order intact.
- Empty state must explain how to broaden search and offer a `Clear filters` action. Loading and error states must not move the surrounding layout.

Catalog result cards can be denser than the detail page. Product images are required when an image exists; provide a stable fallback for missing media.

## Third-party advertising placeholders

Create a reusable `AdSlot` presentation component and an `AdvertisingPlacement` data contract. Until an administration feature exists, render neutral placeholders only; do not embed third-party JavaScript, trackers, or unreviewed HTML.

Required initial placements:

| Slot ID                | Location                                | Suggested reserved size              |
| ---------------------- | --------------------------------------- | ------------------------------------ |
| `home-after-top-views` | Between the first and second Home rails | 970 x 250 desktop / 320 x 100 mobile |
| `home-between-rails`   | Between later discovery rails           | 970 x 90 desktop / 320 x 100 mobile  |
| `home-footer`          | Before the footer                       | 970 x 90 desktop / 320 x 100 mobile  |

Each slot must reserve its dimensions, say `Advertisement` or `Sponsored` visibly, use a non-deceptive placeholder visual, and have no interaction unless a future approved campaign supplies an external destination. The future configuration contract should include `slotId`, `placement`, `active`, schedule, creative media, alt text, destination URL, and optional campaign identifier. Validate destinations and media before rendering them. Lazy-load below-the-fold creative media and respect consent/privacy requirements before any third-party tracking is introduced.

## Feature boundaries for this revision

- `features/catalog`: catalog query model, filter controls, result list, script sort/filter adapters, and `ScriptListItem`.
- `features/home`: Home composition and selection of rail definitions; it must not own catalog filtering logic.
- `features/advertising`: `AdSlot`, placeholder campaigns, `AdvertisingPlacement` contract, and safe rendering rules. It can be consumed by Home and later Catalog without coupling either feature to an admin implementation.
- `shared/ui`: generic primitives only, such as input, sheet, chip, select, and image wrapper.

## Reusable Component Refactor

- Route files compose features only; do not retain duplicated card or Hero markup.
- `features/home/HeroFeaturedScripts` owns the four compact featured-script entries in the Home Hero.
- `features/developers/DeveloperCard` owns seller avatar, public statistics, contact details, profile link, and contact action.
- Reuse `features/catalog/ScriptListItem` in Home rails, Hero featured scripts, Catalog results, and seller profiles.

## Seller Discovery Revision

This revision replaces Collections in the customer navigation and Home page with Sellers.

- Header navigation: `Scripts`, `Sellers`, and `Docs`.
- `Sellers` opens the dedicated directory route `/developers`; each directory entry links to `/developers/{slug}` until the public seller route is introduced.
- Home replaces the previous collection/use-case block with `Featured sellers`.
- Each seller entry links to `/developers/{slug}` and shows the seller name and concise specialty statement.
- Every script listing must expose its seller as a separate, keyboard-accessible link to that profile. The script title remains a separate link to the script detail page; do not nest links.
- Seller profile pages show identity, headline, biography, specialties, and that seller's published scripts using the standard compact listing component.
- The `/developers` directory includes search by name/specialty, distinct profile cards with avatar, verified state, rating, product/view/order counts, joined date, contact details, profile link, and contact action. Paginate at five sellers per page.
- `features/developers` owns seller data, public profile components, and the seller-to-script relationship. `features/catalog` only consumes its public seller slug helper for author links.
