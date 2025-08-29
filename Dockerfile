# Multi-stage build for Gibberlink Decoder Gateway
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/protocol-core/package.json ./packages/protocol-core/
COPY packages/transports/package.json ./packages/transports/
COPY apps/gateway/package.json ./apps/gateway/
COPY apps/echo-peer/package.json ./apps/echo-peer/

# Install pnpm
RUN npm install -g pnpm@8.15.0

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build all packages
RUN pnpm build

# Gateway stage
FROM node:20-alpine AS gateway

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy built gateway
COPY --from=base /app/apps/gateway/dist ./dist
COPY --from=base /app/apps/gateway/package.json ./
COPY --from=base /app/packages/protocol-core/dist ./node_modules/@gibberlink/protocol-core
COPY --from=base /app/packages/transports/dist ./node_modules/@gibberlink/transports

# Install production dependencies only
RUN npm install --only=production

# Create directories for logs and data
RUN mkdir -p /app/logs /app/data

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/v1/health || exit 1

# Start gateway
CMD ["node", "dist/index.js"]

# Echo peer stage
FROM node:20-alpine AS echo-peer

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy built echo-peer
COPY --from=base /app/apps/echo-peer/dist ./dist
COPY --from=base /app/apps/echo-peer/package.json ./
COPY --from=base /app/packages/protocol-core/dist ./node_modules/@gibberlink/protocol-core
COPY --from=base /app/packages/transports/dist ./node_modules/@gibberlink/transports

# Install production dependencies only
RUN npm install --only=production

# Create directories for logs
RUN mkdir -p /app/logs

# Expose port
EXPOSE 9999

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9999/health || exit 1

# Start echo-peer
CMD ["node", "dist/index.js"]
