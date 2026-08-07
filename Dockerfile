# Stage 1: Build the application
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production environment
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Install serve to run the application
RUN npm install -g serve

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV PORT=3000
CMD ["serve", "-s", "dist", "-l", "3000"]
