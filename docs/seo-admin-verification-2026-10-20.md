# SEO Admin verification — 20 October 2026

The edited SEO values reach production-rendered public HTML on the next request. The test exercised the real Next admin proxy, password authentication, backend controllers, MySQL persistence, and production Next page rendering. This was a local production build against disposable copies of the site and CRM databases, not a deployment or Google indexing test.

## Passed checks

| Area | Verified |
| --- | --- |
| Authentication | Correct password login, invalid password/unauthenticated rejection, HttpOnly/SameSite session cookie, current user and logout |
| Project main page | Title, description, H1/H2, summary, highlights, landmarks, visible FAQ, entity/FAQ JSON-LD, robots, photo alt/title/caption, cover image in OpenGraph and Twitter |
| Project children | Floor plans, photos, amenities and locality: independent titles/descriptions/H1/intros/canonicals/robots and JSON-LD |
| Property main page | Same main-page SEO checks; primary inventory thumbnail in OpenGraph and Twitter |
| Property children | Floor plan and photos: independent metadata/headings/intros/canonicals/robots and JSON-LD |
| Repeated edits | Updated values replace old values immediately; stale revisions rejected; reopened editor resolves the current custom path |
| Custom URLs | Real HTTP 301 from old path; new canonical and child routes remain correct |
| Social image overrides | Custom image survives saving; choosing Automatic restores the project cover/property primary thumbnail; the default is independent of the saved override |
| Core pages | All ten requested routes: title/H1/H2, intro, Markdown bottom content, FAQ before footer and custom Service schema |
| Auto templates | Saving a template regenerates fallback public metadata with Sale/Rent/type/city tokens expanded |
| Listing pages | Sale and Rent: visible title/H1/H2/copy/FAQ/Markdown; live counts agree with SQL; market snapshot toggle updates immediately |
| Technical SEO | Saved robots.txt and llms.txt appear immediately; redirect create/delete and real 301; sitemap index serves successfully |
| Heading structure | Exactly one H1 on each tested main, child, core and listing page |
| Inventory isolation | Properties, projects, units and property images hash identically before/after all SEO saves |
| Migrations | Backfill, Sale/Rent templates and 512-byte ASCII unique path indexes pass verification |

Coverage uses one representative project and property, all their six required child routes, ten core/service routes, two listing rules, custom URL variants, templates and technical settings. The inventory image audit separately inspected all locally live projects/properties. The HTTP runner reports **25 passing integration groups**.

The production build and frontend/backend TypeScript checks pass. Focused frontend SEO tests pass (28 tests), backend SEO/auth/availability tests pass (34 tests), and property gallery interaction tests pass (44 tests).

## Bugs fixed during verification

1. The frontend proxy rejected slash-containing core-page config keys, blocking core SEO saves. It now forwards validated core keys as a single encoded parameter, including the existing NRI key format. Traversal and cross-origin protections remain tested.
2. Saving an edited `custom_schema_json` alongside an unchanged hydrated `schema_overrides` alias could silently retain the old schema. Normalization now preserves the edited value in either API shape.
3. The editor could identify a saved custom social image as the inventory default. The backend now returns the actual inventory default separately. Automatic selection stores an empty override so later CRM cover/thumbnail changes can flow through.
4. Reopening an inventory editor after a custom path change could resolve the old redirect instead of effective SEO. It now resolves the current public path.

A gallery test was also updated to query the existing semantic `figure` instead of an obsolete `region`; all original primary-photo and keyboard/button assertions still run and pass.

## Existing local image-data problems

The automatic image selection is correct, but several source images are absent or unavailable. These are findings from the local database and image host, not a production inventory assertion.

| Local record | Image finding |
| --- | --- |
| Project 4 — Lakeview Residences | Cover returns HTTP 404 |
| Project 5 — Palm Meadows Villas | Cover returns HTTP 404 |
| Project 6 — Emerald Heights | Cover returns HTTP 401 |
| Project 7 — Casa Grand | No cover configured |
| Property 9 | Primary image returns HTTP 404 |
| Other live properties | 941 of 949 have no property image row; the other seven configured property images respond with HTTP 200 and image content types |

The affected source images need to be restored/replaced in inventory. SEO cannot create a real property thumbnail or project cover from absent media. No source inventory or sync endpoints were modified to mask these findings.

## Wider test suite and limits

The full frontend suite has **625 passing tests and three failures outside the SEO changes**. The affected source/test files are unchanged by this work:

- `property-wizard.schema.test.ts`: its valid-data fixture fails the current basic-info schema.
- `Step3Location.test.tsx`: `/City/i` matches multiple labeled controls.
- `home-search.test.tsx`: the test expects the old search placeholder.

Interactive browser automation was unavailable (`Browser is not available: iab`). Editor interactions are covered with React Testing Library; save-to-page behavior was checked over actual HTTP with a production frontend build. Google recrawling, rich-result eligibility and rankings were not measured.

## Repeat verification

From `site/majestan-backend`, using the existing local environment:

```bash
bun run scripts/verify-seo-http.ts
bun run scripts/verify-seo-engine.ts
bun run scripts/verify-seo-migration.ts
bun run test -- --runInBand seo-fields seo-utils seo-auth admin-seo-availability
```

The HTTP runner needs database-create privileges, ports 5098/3099 free, and an existing active Admin/Super Admin to copy into its disposable CRM fixture. It changes that fixture's password only. It restores the frontend tsconfig, stops its child servers and removes its test databases/build output. Existing development servers and account passwords remain untouched.
