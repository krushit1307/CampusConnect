# Use the official lightweight Bun image
FROM oven/bun:alpine AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS install
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile

# Stage 2: Development environment
FROM base AS dev
COPY --from=install /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]

# Stage 3: Build the application for production
FROM base AS builder
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Stage 4: Production runner environment
FROM base AS runner
ENV NODE_ENV=production
USER bun
COPY --chown=bun:bun --from=builder /app/.output ./.output
EXPOSE 3000
ENV PORT=3000
CMD ["bun", ".output/server/index.mjs"]
