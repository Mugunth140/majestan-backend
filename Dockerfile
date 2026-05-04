FROM oven/bun:alpine
WORKDIR /app
COPY package.json ./
COPY bun.lock ./
RUN bun ci
COPY . .
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "start:prod"]

