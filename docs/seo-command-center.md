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

The database scripts verify backfill, MySQL 8 indexes, rollback/reapply, all four transaction intents, statistics, immediate updates, thin-content rules, stale writes, redirects, nested paths, and unchanged inventory. Expiry and deletion behavior is tested only on isolated database copies.

Frontend validation covers production build, TypeScript, existing API/SEO/listing tests, responsive admin rendering, fixture-account login and a temporary rule saved through the UI. Raw HTML checks verify the custom title, description, one H1, H2, intro/bottom content, live stats, JSON-LD and noindex behavior. All temporary accounts and test rules are removed afterward.

## Individual page editor

The Admin Panel provides five tabs: core search/sub-pages, local entity/schema, AI search/FAQs, media descriptions, and indexing/social/redirects. Overrides live only in SEO tables. `settings.entity` stores locality, postal code, builder, RERA, price range, coordinates and landmarks. `settings.ai_summary` and highlights render as semantic content and schema description; focus/secondary keywords feed schema keywords. Raw graph overrides merge matching `@id` or `@type` nodes recursively; unmatched nodes extend the graph. Image alt overrides use source URLs so photo and floor-plan identifiers cannot collide.

Main and child route metadata uses absolute titles. Section metadata inherits template values and supports individual title, description, H1 and canonical overrides. A changed slug creates a 301 by default; the editor can disable automatic redirects. Off-market redirects apply to both projects and properties and must point to a saved locality listing page.
