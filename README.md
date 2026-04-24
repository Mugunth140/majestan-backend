# Majestan Backend

NestJS backend for the Majestan real estate platform, configured for Bun runtime and secure API defaults.

## Prerequisites

- Bun 1.3+
- MySQL 8+

## Setup

```bash
bun install
cp .env.sample .env
```

Update the values in .env before starting the API.

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

## Quality Checks

```bash
bun run lint
bun run test
bun run test:e2e
```
