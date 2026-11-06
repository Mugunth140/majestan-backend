# Production memory recovery — 6 November 2026

## Follow-up: excessive joined rows in property details

The first deployment's diagnostics showed 769 MiB of JS heap and 1,163 MiB
RSS after only 34 completed responses, with a peak of five concurrent
responses. The process was killed again. The concurrency and memory limits
contained the failure but did not fix this allocation source.

The property detail loaders joined every independent collection in one
TypeORM query. Read-only counts of the two reported production properties
showed the following Cartesian products (zero-child LEFT JOINs count as one):

| Property | Amenities | Furnishings | Images | FAQs | Joined rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prozone Palms, 2640 | 26 | 9 | 17 | 35 | 139,230 |
| Purnaya Developers Adhya, 2642 | 12 | 3 | 21 | 35 | 26,460 |

The driver materializes these duplicate, wide rows before TypeORM deduplicates
the entities. Repeated requests or several simultaneous requests can exhaust
memory even though the serialized property response is small. This is a
query allocation explosion; the evidence does not establish a Bun runtime leak.

Public property details (slug, type/id and suffix recovery) and the site
admin property editor now explicitly use `relationLoadStrategy: 'query'`.
The same relations, nested data, approval checks and redirects remain; each
collection is fetched separately instead of multiplying sibling collections.
Project details already load collections separately and do not use this join.

The local MySQL regression script creates and drops its own scratch database,
with the real entities and service methods. It accepts only a loopback DB
host. It verifies all images/amenities/furnishings/FAQs, nested amenity and
furnishing names, location, property specifications and SEO; it also exercises
the type/id route, suffix recovery, admin details and missing records.
It instruments the actual query runner and fails if any query returns more
rows than the largest collection. The joined baseline uses smaller collection
sizes to avoid deliberately exhausting memory. No production load test is used.

```bash
bun run build
DB_HOST=127.0.0.1 DB_PORT=3306 DETAIL_SOAK_ITERATIONS=20 bun scripts/verify-property-detail-memory.cjs --baseline
DB_HOST=127.0.0.1 DB_PORT=3306 DETAIL_SOAK_ITERATIONS=1000 bun scripts/verify-property-detail-memory.cjs
```

Initial corrected run: 1,000 lookups with Prozone-sized collections, at most
35 rows per query, RSS 106→151 MiB and JS heap 24 MiB after final GC. Continue
observing real production traffic after deployment; this removes a demonstrated
allocation source, not proof that no other memory issue exists.

## Confirmed incident

The kernel reported `global_oom` and killed the backend Bun process at
16:48:35 UTC and 17:00:24 UTC (22:18:35 and 22:30:24 IST). Anonymous RSS was
4,157,736 KiB and 4,098,452 KiB respectively. The 8 GiB host had no swap;
the running backend had no container memory limit. The second restart
completed at 17:00:32 UTC. Frontend socket errors and connection refusals
match that restart window. The backend was running Bun 1.4.4.

The public site access log contains 1,285 requests between 16:45 and
17:01 UTC, including 563 identifying as Meta's external crawler. This
establishes concurrent crawling, not the origin of the memory growth.
Both reported URLs returned 200 after their canonical redirects during
the investigation.

## Prepared protection and diagnostics

- `deploy/docker-compose.override.yml` caps total backend memory at 1,536 MiB and
  disables swapping for that container. A backend OOM can still cause a
  restart, but the backend cannot consume 4 GiB and exhaust the whole host.
- In production, `MAX_IN_FLIGHT_REQUESTS` defaults to 32. Excess responses
  receive 503 and `Retry-After: 5` immediately; there is no waiting queue.
  This caps simultaneously open responses, not SQL work that continues
  after a disconnected client. Existing response listeners are removed
  on both completion and disconnect.
- `RuntimeMemory` logs every 60 seconds by default. It reports process RSS,
  JS heap, external/array buffer memory, uptime, response concurrency and
  counts of completions/rejections. No request data or credentials are logged.

These changes are containment and diagnostic work. They do not establish
that the underlying growth has been fixed.

## Deploy and investigate

Build and test a backend image containing these changes. Install
`deploy/docker-compose.override.yml` beside the VPS site's existing
`docker-compose.yml` (check for an existing override before copying).
The repository root's sibling `site/docker-compose.yml` is not versioned
in this backend repository, and inspection showed that production differs
from that local Compose definition. The small override preserves the
server's current environment, network and volume configuration and only
adds backend memory limits. Docker Compose loads it during the existing
webhook deployment. Do not also pass `-f docker-compose.yml` alone, which
would bypass the override.

The current checkout also contains unrelated analytics and enquiry work;
do not ship all of it implicitly as part of this incident fix.

From the server's site Compose directory, after selecting the tested image:

```bash
docker compose config --quiet
docker compose up -d --no-deps site-backend
docker inspect site-site-backend-1 --format '{{.HostConfig.Memory}}'
docker logs --since 10m site-site-backend-1 2>&1 | grep RuntimeMemory
docker stats --no-stream site-site-backend-1
```

The inspected memory limit should be `1610612736`. Expect one brief backend
restart when applying the image/limit. No production changes were applied
during the initial investigation; apply the override and deploy the tested
image together when releasing this change.

Use an isolated staging environment and a representative copy of the
database to replay property, project, listing, routing and sitemap GETs,
first serially, then with controlled concurrency. Record several batches
and idle periods. Do not load-test this production host. If uploads
correlate with growth, test those separately with disposable storage keys.

- **Heap keeps rising after idle/GC:** compare heap snapshots and retained
  references. Investigate caches, throttler state, ORM entities and listeners.
- **RSS rises while heap is stable:** investigate native buffers, HTTP
  compression, MySQL connections, image processing and Bun's runtime. Compare
  the same workload with compression disabled and a compatible runtime in
  staging before choosing a runtime change. RSS alone does not prove a leak.
- **Memory follows concurrency and drops after idle:** bound the expensive
  request path, reduce repeated queries and response payload sizes, then
  tune admission capacity using measured peak memory per request.

A local synthetic Express/compression probe using Bun 1.4.4 completed
2,500 requests without sustained growth (RSS settled around 60 MiB).
It did not include Nest, MySQL, real data or uploads and is not a backend
soak test. It is insufficient evidence to blame or clear the runtime.

Call the incident resolved only after the representative workload reaches
a stable memory plateau and the deployed service survives normal traffic
and crawler bursts without further OOM kills. Observe at least a full day
covering a normal peak period; a short successful smoke test is insufficient.

An administrator can additionally provision host swap after checking disk
capacity and existing swap configuration. Swap offers spike headroom; it
does not cure a leak. The backend cap intentionally does not depend on it.

## Rollback

Restore the previous backend image if behaviour regresses. Keep the host
protection unless measurements show legitimate requests require a larger
budget; lowering concurrency trades throughput for available memory.
Adjust `MAX_IN_FLIGHT_REQUESTS` and `MEMORY_LOG_INTERVAL_MS` through the
deployment environment. Avoid scheduled restarts as the final resolution.

## CRM redesign compatibility

The pending CRM dashboard and task redesign runs in a separate repository
and process. Its role dashboards query the CRM analytics mirror, not this
backend. The website analytics integration does call this backend, but its
upstream client already translates a 503 into a retryable unavailable
response and enforces an eight-second timeout. Its 30 service/controller
tests passed with the pending redesign present. The pending site analytics
store also has its own 256 MB DuckDB budget, within the total-process cap.

The memory change does not alter API success envelopes, database schemas,
authentication, property/project data, or enquiry payloads. Under overload,
website analytics may report temporarily unavailable along with public
requests. Only memory-related hunks should be staged in the backend's shared
environment files; keep the pending analytics and enquiry work uncommitted.
