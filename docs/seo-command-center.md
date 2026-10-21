# Admin Panel

The website admin is available at `/admin`, with CRM email/password login at `/admin/login`. It has exactly five modules: projects, individual properties, locality listing rules, core/service pages, and technical SEO. SEO saves apply immediately. There is no publication, approval, or draft workflow.

## Boundaries

- `crm/crm-backend/src/modules/properties/site-api.service.ts` is unchanged.
- Every pre-existing site backend `/admin` sync controller and its inventory/master-data service is unchanged.
- The sole legacy SEO service fix removes property availability updates from `upsertPropertySeo`. Its old endpoint remains compatible.
- New endpoints live under `/api/v1/seo-admin` and `/api/v1/seo-engine`.
- New SEO sessions do not authenticate against legacy sync endpoints. Customer and OTP authentication are unchanged.
- Inventory facts, prices, projects, locations, publication and availability remain owned by CRM. New SEO operations write only SEO tables.
- TypeORM schema synchronization is disabled; schema changes use migrations.

## Database and migration

`1784600000000-SeoCommandCenter.ts` creates `seo_configs`, `seo_listing_pages`, and `seo_redirects` in the site database. `public_path` and `source_path` use `VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin` with unique indexes. Inventory foreign keys use `ON DELETE SET NULL`, retaining the last public path for redirects. Legacy SEO tables are retained for compatibility. Existing section data and metadata are backfilled, and 71 default templates cover properties, projects and locality pages, including all-type listing fallbacks.

`035_add_seo_permission.sql` adds the assignable `seo.manage` permission to CRM. It grants no staff access automatically and changes no accounts/passwords.

Normal deployment commands:

```bash
# Site database, using its existing migration runner
cd site/majestan-backend
bun run migration:run

# CRM permission migration, using its existing migration runner
cd infra
docker compose run --rm db-migrate
```

Run these in their respective directories; use normal deployment backups. The local implementation applied only the SEO migration and permission migration, leaving unrelated pending migrations alone.

## Production SEO migrations

Deploying the application image does not apply database migrations. For the SEO feature only, run this in the site backend container after deploying its image:

```bash
docker exec site-site-backend-1 bun run migration:seo
```

This runs only migrations `1784600000000`, `1784700000000`, and `1784800000000`, using TypeORM migration history to skip already applied ones. It leaves unrelated pending inventory migrations alone. CRM permission migration `infra/migrations/035_add_seo_permission.sql` must also be applied through the infrastructure migration process; it adds the assignable permission without granting it to staff.

On 20 October 2026, production returned HTTP 500 because all three SEO tables were absent after image deployment. The three SEO migrations were applied, 44 legacy property SEO records were backfilled, and 37 templates, 12 core pages and the technical config were provisioned. The CRM SEO permission was added idempotently. Inventory hashes were unchanged; no inventory/sync routes were modified. Legacy SEO and migration history were backed up on the server before the repair.

## Authentication configuration

The site backend reads existing `majestan_crm.users`, bcrypt hashes, active status, roles and user permissions. Admin/Super Admin have access. Other staff need `seo.manage`, assigned through CRM's existing user permissions UI.

Optional backend environment variables:

- `CRM_DB_NAME`: defaults to `majestan_crm`.
- `CRM_DB_HOST`, `CRM_DB_PORT`, `CRM_DB_USERNAME`, `CRM_DB_PASSWORD`: default to the site connection settings. Use a read-only CRM database account in production.
- `SEO_SESSION_SECRET`: an independent signing secret. If absent, a domain-separated key is derived from the existing access secret and CRM database name.
- `FRONTEND_URL`: additional permitted browser origin.

SEO authentication uses an eight-hour HttpOnly, SameSite=Strict cookie, Secure in production. Active status and current access are checked on every protected request. The frontend proxy checks request origins before writes. Passwords and tokens are not stored in localStorage.

Frontend server calls use the absolute `API_BASE_URL`, an absolute `NEXT_PUBLIC_API_BASE_URL`, or `SITE_BACKEND_URL` with `/api/v1`. The existing `/site-api` browser proxy is preserved in Next.js 16's `proxy.ts` convention.

## Listing rules and rendering

- `buy`: all `Sell` inventory, displayed as Sale.
- `rent`: all `Rent` inventory, displayed as Rent.

Available inventory is read without changing its status. Expired properties are excluded using Coimbatore's calendar day. Projects use their existing published status as a read filter only, and support Sale rules; project categories remain apartments, villas, and plots.

The public listing lookup is `/api/v1/seo-engine/listing-page?path=...`. It returns editorial overrides, matching inventory, statistics, effective robots, and structured data. The frontend consumes it server-side. Automatically generated listing routes retain their search UI. Explicit saved rules also support arbitrary clean paths, including nested paths. Inventory section links (photos, amenities and floor plans) follow the custom base path and retain canonical metadata.

Titles, descriptions, headings, canonical/robots, social metadata, FAQ JSON-LD and summaries use the new config. Metadata fetches are uncached and successful admin writes invalidate the frontend layout cache. Property and project API consumers apply section overrides and image-alt metadata without changing source records.

Thin inventory sets `noindex, follow` by default below two matching listings, unless the rule is pinned. Explicit noindex still wins. Price statistics omit unknown/nonpositive prices and zero/unknown areas; sale and monthly rental figures remain separate. Statistics state their sample size. JSON-LD ItemList entries match the rendered listings.

Canonical paths and redirects are SEO-owned; changing an inventory path does not edit the CRM slug. Redirects are 301, survive deletion, and reject loops and unsafe paths. Core/service route paths are fixed; their metadata can be edited.

## Technical SEO

`/sitemap.xml` indexes five dynamic sitemaps: projects, properties-buy, properties-rent, localities, and pages. Redirect sources, noncanonical overrides, noindex records, unavailable inventory, and thin locality pages are excluded.

`/robots.txt` uses the technical editor with admin/API exclusions. `/llms.txt` generates an inventory summary unless an editorial override is supplied.

Priority saves update dynamic sitemaps immediately. To enable IndexNow, set the same `INDEXNOW_KEY` on backend and frontend. The public `/indexnow-key.txt` route verifies ownership via the submitted keyLocation. IndexNow failure does not undo an SEO save. The key is intentionally public for verification.

Organization NAP defaults to the supplied Hope College address and phone. Enter verified office coordinates in Technical SEO to emit office GeoCoordinates; no coordinates were invented. Inventory GeoCoordinates use existing location data.

Project schema uses the Schema.org [GatedResidenceCommunity](https://schema.org/GatedResidenceCommunity) vocabulary for villas, and ApartmentComplex/Place for other project categories. Offers are attached to the corresponding RealEstateListing. Structured data and visible content share the same facts; no search-ranking or AI-citation guarantee is implied.

## Verification

```bash
# New regression/auth tests (from site/majestan-backend)
bun run test -- --runInBand --runTestsByPath src/modules/seo-engine/seo-utils.spec.ts src/modules/seo-engine/seo-auth.spec.ts src/modules/admin/seo/admin-seo-availability.spec.ts

# Isolated MySQL copies; creates then removes verification databases
bun scripts/verify-seo-migration.ts
bun scripts/verify-seo-engine.ts

bun run build
```

The database scripts verify backfill, MySQL 8 indexes, rollback/reapply, Sale/Rent intents, statistics, immediate updates, thin-content rules, stale writes, redirects, nested paths, and unchanged inventory. Expiry and deletion behavior is tested only on isolated database copies.

Run `bun run scripts/verify-seo-http.ts` from the backend for real admin-proxy saves, fixture-account login and production SSR checks against disposable site/CRM database copies. It verifies titles/descriptions, one H1, H2, copy, live stats, JSON-LD, robots, default/custom social images, templates, custom paths and technical settings. Editor interactions also have component tests. Browser automation was unavailable for the latest run. See [the verification report](seo-admin-verification-2026-10-20.md) for coverage, existing image-data problems and the wider test-suite results.

## Individual page editor

The Admin Panel provides five tabs: core search/sub-pages, local entity/schema, AI search/FAQs, media descriptions, and indexing/social/redirects. Overrides live only in SEO tables. `settings.entity` stores locality, postal code, builder, RERA, price range, coordinates and landmarks. `settings.ai_summary` and highlights render as semantic content and schema description; focus/secondary keywords feed schema keywords. Raw graph overrides merge matching `@id` or `@type` nodes recursively; unmatched nodes extend the graph. Image alt overrides use source URLs so photo and floor-plan identifiers cannot collide.

Main and child route metadata uses absolute titles. Section metadata inherits template values and supports individual title, description, H1 and canonical overrides. A changed slug creates a 301 by default; the editor can disable automatic redirects. Off-market redirects apply to both projects and properties and must point to a saved locality listing page.

## Full field provisioning (1784800000000)

The three SEO tables remain the only SEO storage. `seo_configs` retains scalar metadata and JSON section/media/schema/settings payloads; new listing `show_live_market_snapshot` is a dedicated default-true boolean. Canonical API field names are exposed directly, while entity facts live under `settings.entity`, AI/keyword/lifecycle/core-copy fields under `settings`, and structured media under `image_alt_overrides` (also exposed as `image_alts`). Legacy string alt values and camelCase/hyphenated section names remain readable. New API saves normalize them to canonical snake_case section fields and preserve unchanged editorial fields.

Inventory manual titles are limited to 60 characters and descriptions to 160. Automatic templates retain their full patterns. Project children are `floor_plans`, `photos`, `amenities`, and `locality`; property children include `floor_plan` and `photos`. Each has dedicated metadata, H1, introduction, canonical, and index control. The public resolver supports child paths and generated sitemaps include eligible children. Root noindex takes precedence. The template token set includes `Max_Price`, `Builder_Name`, `RERA_ID`, and per-image `Index` in addition to existing tokens.

Social images fall back to the primary property image or project cover, resolved through the existing storage service. The same images appear as admin inventory thumbnails. Optional alt, title, and caption values bind to stable media keys with URL compatibility aliases. Property/schema overrides never write CRM facts or inventory status. Unknown builder and approval details remain blank; a project name is never used as an inferred builder name. Commercial/industrial/coworking categories use Schema.org `Place` plus `additionalType`; villas use `GatedResidenceCommunity` for project developments.

Listing rules support Sale and Rent (including rental project units), with 4 bedrooms meaning 4 or more. Project prices and price-per-area statistics use matching available units and the appropriate sale-price or monthly-rent field. Turning off the market snapshot hides its HTML table; automatic count/price FAQs remain independently configurable.

A property can retain a read-only off-market page with its public facts, media, and an availability banner. Those pages emit no active offer. Hard deletion still redirects to the configured locality page, or returns Gone if no destination exists. Snapshots are allowlisted public fields and never expose CRM owner/contact or internal verification records. Sign out and Cancel use the red action treatment.

The core NRI alias `/services/nri-services` is provisioned separately; the existing `/services/nri-property-investment` route stays available. Core copy and custom FAQs render before the website footer. Markdown is rendered as escaped semantic headings, paragraphs, and lists; raw HTML is not injected.

## Public layout correction — 21 October 2026

The visitor-facing listing and main property/project overview routes no longer inject separate SEO fact grids, AI summary blocks, market snapshot tables, intro/bottom guides or automatic listing FAQs. Existing gallery, search results, inventory details and native FAQ sections remain the page content. Titles, descriptions, canonical/robots, OpenGraph, media SEO and JSON-LD continue to use the SEO engine. Stored editorial fields are retained; this change does not delete SEO records or alter inventory.

Listing JSON-LD keeps the current visible ItemList and page/breadcrumb nodes. It removes the additional FAQPage node because the corresponding listing FAQ block is no longer shown. Existing property/project FAQs still render in their regular sections and retain their markup. The same content is served to browsers and crawlers; there is no crawler user-agent branch or hidden keyword block.

`/[slug]/[...section]` now explicitly uses per-request rendering (`force-dynamic`). Previously its empty static-params list combined with ISR made direct child routes fail at runtime when uncached organization/SEO requests executed. The verification runner now tests all project/property direct child routes before creating an SEO config, so SEO rewrites cannot conceal this regression.

Verification: 27 isolated HTTP integration groups; 55 targeted frontend content/schema/gallery tests; TypeScript and a production Docker build. Live deployment is verified separately against the reported listing and Alamo Turin/property child routes.
