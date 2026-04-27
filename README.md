# Majestan Backend

NestJS backend for the Majestan real estate platform, configured for Bun runtime and secure API defaults.

## Prerequisites

- Bun 1.3+
- MySQL 8+

## Setup

```bash
bun install
cp .env.sample .env
bun run db:init
```

Update the values in .env before starting the API.

The db:init command creates all required tables and seeds a default admin user.

## Run With Bun Runtime

```bash
# start once
bun run start

# watch mode
bun run start:dev

# production (after build)
bun run build
bun run start:prod
```

## API Documentation (Swagger)

Swagger is enabled when ENABLE_DOCS=true.

- URL: [http://localhost:4000/api/v1/docs](http://localhost:4000/api/v1/docs)
- Env controls:
  - DOCS_PATH
  - DOCS_TITLE
  - DOCS_DESCRIPTION
  - DOCS_VERSION

## Admin Endpoints

All admin endpoints require JWT auth with admin role.

- POST /api/v1/auth/admins
- POST /api/v1/auth/change-password
- GET /api/v1/admin/dashboard/summary
- GET|POST /api/v1/admin/blogs
- GET|PATCH|DELETE /api/v1/admin/blogs/:id
- PATCH /api/v1/admin/blogs/:id/status
- GET|POST /api/v1/admin/banners
- GET|PATCH|DELETE /api/v1/admin/banners/:id
- PATCH /api/v1/admin/banners/:id/status
- GET /api/v1/admin/business/setup
- PUT /api/v1/admin/business/setup
- GET /api/v1/admin/business/profile
- PUT /api/v1/admin/business/profile
- GET /api/v1/admin/enquiries
- GET /api/v1/admin/sale-enquiries
- GET /api/v1/admin/property-submissions
- GET|POST /api/v1/admin/properties/:propertyType
- GET|PATCH|DELETE /api/v1/admin/properties/:propertyType/:id
- PATCH /api/v1/admin/properties/:propertyType/:id/status
- PATCH /api/v1/admin/properties/:propertyType/:id/booking-status

## Quality Checks

```bash
bun run lint
bun run test
bun run test:e2e
```
