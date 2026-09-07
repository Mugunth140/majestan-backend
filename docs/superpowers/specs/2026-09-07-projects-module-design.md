# Projects Module — Design Spec

Date: 2026-09-07. Status: approved for implementation.
Scope: new-construction projects (villa / apartment only) across site-backend, site-frontend, site-admin, CRM-backend, CRM-frontend. Reference model: 99acres project pages (price range, BHK configs, area range, possession, RERA, amenities, floor plans, builder).

## Decisions (from brainstorming)

1. Storage: new `projects` + `project_units` tables in site-backend. No `is_project` flag on properties.
2. Units terminology: "Units". `project_units` is a full field-clone of `property_units`.
3. One API on site-backend. Creation + edits in CRM only (CRM-backend proxies via existing `SiteApiService`, same as properties). Display on site (listing + detail) and CRM (data tables). SEO editing in site-admin only.
4. Site surface: single detail page per project with anchor-scrolled sections (overview, configurations, floor-plans, amenities, locality, photos, builder, FAQs). Existing `projects/[city]/[projectSlug]/*` sub-routes redirect to anchors.
5. Ranges (price, sqft, BHK set) are computed from units at read time, never stored.
6. `properties.projectId` nullable FK links resale/rental listings to a project; free-text `projectName` stays until migrated.

## Data model (site-backend, TypeORM `synchronize: true`, no manual migration)

`projects`: id, name, slug (unique), canonicalSlug (unique), projectType enum (`apartment`,`villa`), builder, reraNumber (nullable), possessionDate (nullable), possessionStatus enum (`under_construction`,`ready_to_move`), city, sublocation, address, towers (nullable int), totalUnits (nullable int), description (longtext), status enum (`draft`,`published`,`archived`, default `draft`), timestamps.
`project_units`: all `property_units` columns cloned (unitCode unique per project, title, unitType, bedrooms, bathrooms, balconies, floorNo, totalFloors, carpet/builtup/super-builtup sqft, furnishedStatus, facing, listingMode default `sale`, price, monthlyRent, maintenanceFee, availableFrom, status default `available`, floorPlanImageUrl/Key, isPrimary) + `projectId` FK cascade.
`project_seo`: mirrors `property-seo` entity (title, description, og fields, robots, FAQs) 1:1 to project.
Media: reuse `storage` presigned-url flow; v1 uses `coverImageUrl` + `galleryImageUrls` (JSON) columns on `projects`. Migrate to a link table only if ordering/reuse demands it.
Amenities: reuse `amenity` master via link table mirroring `property-amenity`.

## API (site-backend)

Public (`@Public()`, `ProjectsController`, prefix `projects`): `GET /projects` (query: city, projectType, bhk, minPrice, maxPrice, possession, rera=true, page, limit), `GET /projects/by-slug/:slug` (detail + units + computed ranges + seo), `GET /projects/all-slugs`.
Admin (`AdminProjectsModule`, prefix `admin/projects`, JWT + roles): full CRUD incl. nested units write (replace-all-units on update), `PATCH status`, SEO sub-resource mirroring admin properties-seo endpoints.
Ranges computed in service: min/max price, min/max builtup, sorted BHK list, from `available` units.
CRM-backend `ProjectsModule`: controller + service proxying site API through `SiteApiService`; no local tables (same pattern as `PropertiesModule`).

## CRM frontend (replaces both "coming soon" stubs)

`/projects` table: search (debounced 500ms, existing hook pattern), filters (city, type, possession, status), pagination; columns: name, type, city, price range, BHK set, units count, RERA, status.
`/projects/new` + `/projects/:id`: project fields + dynamic units editor (add/remove rows, full unit fields per row, client-side range preview).
Later follow-up (out of scope v1): leads `PROJECTS` constant and property `projectName` text → project API dropdowns.

## Site frontend

Rebuild `projects/[city]/[projectSlug]/page.tsx` into the single full page: hero (price range, BHK chips, area range, possession, RERA badge), About, Configurations table (BHK–area–price per unit), Floor plans, Amenities, Locality/Map, Builder, FAQs, Similar projects, sticky tab bar scrolling to anchors.
`generateMetadata` + `ApartmentComplex` JSON-LD (aggregate price/area/offers). ISR `revalidate = 300`. `all-slugs` into `generateStaticParams` + `sitemap.ts`. Legacy sub-routes (`photos`, `floor-plan`, `amenities`, `map`) → `permanentRedirect` to anchored detail URL.
New `/projects` index (listing + filters: budget, BHK, city, possession) reusing `ListingPage` card patterns; canonical + ItemList JSON-LD.

## Site admin (SEO only)

`/admin` projects-SEO editor reusing property-SEO components against `admin/projects/:id/seo`. No project data CRUD in site-admin.

## Edge cases

Slug collision with `[slug]` property route: project canonical URLs live under `/projects/:city/:slug`; `by-slug` lookup scoped to projects table only. Draft/archived projects: `noindex`, excluded from listing/sitemap/slugs. Empty units: ranges hidden, page still renders. Currency formatting reuses `formatPrice` helpers.

## Rollout (each shippable independently)

1. Site-backend tables + public/admin API. 2. CRM-backend proxy. 3. CRM create/edit UI. 4. Site public detail + listing. 5. Site-admin SEO + sitemap/redirects.
