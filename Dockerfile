FROM oven/bun:alpine
WORKDIR /app
COPY package.json ./
COPY bun.lock ./
RUN bun ci
COPY . .
RUN bun run build
EXPOSE 3000
# exec makes the app PID 1 so it receives SIGTERM on deploy; `bun run` does not forward it.
CMD ["sh", "-c", "bun scripts/ensure-seo-schema.ts && exec bun dist/src/main.js"]

