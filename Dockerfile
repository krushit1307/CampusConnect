# Use the official Node image
FROM node:22-alpine AS base
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS install
COPY package*.json ./
RUN npm ci

# Stage 2: Development environment
FROM base AS dev
COPY --from=install /app/node_modules ./node_modules
COPY . .
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]

# Stage 3: Build the application for production
FROM base AS builder
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 4: Production runner environment (using serve for SPA)
FROM node:22-alpine AS runner
ENV NODE_ENV=production
RUN npm install -g serve
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV PORT=3000
CMD ["serve", "-s", "dist", "-l", "3000"]
