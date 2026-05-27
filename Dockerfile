# ============================================================
# PayIn API - Multi-stage Dockerfile
# ============================================================
# Stage 1: Build all TypeScript packages and apps
# Stage 2: Create optimized production image
# ============================================================

# ============================
# Stage 1: Builder
# ============================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/monitor/package*.json ./packages/monitor/
COPY packages/processor/package*.json ./packages/processor/
COPY packages/notification/package*.json ./packages/notification/
COPY packages/email/package*.json ./packages/email/
COPY packages/auth/package*.json ./packages/auth/
COPY packages/manager/package*.json ./packages/manager/
COPY packages/test-utils/package*.json ./packages/test-utils/
COPY apps/api/package*.json ./apps/api/

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY scripts/ ./scripts/

# Build all packages in dependency order
RUN echo "Building packages..." && \
    npx tsc --build packages/shared --force && \
    npx tsc --build packages/monitor packages/notification packages/email --force && \
    npx tsc --build packages/processor --force && \
    npx tsc --build packages/auth packages/manager --force && \
    echo "Building apps/api..." && \
    cd apps/api && \
    npm run build && \
    cd ../.. && \
    echo "Verifying build output..." && \
    ls -la apps/api/dist/ && \
    echo "Build complete!"

# ============================
# Stage 2: Production
# ============================
FROM node:20-alpine

# Install runtime dependencies AND build tools (needed for native modules)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/monitor/package*.json ./packages/monitor/
COPY packages/processor/package*.json ./packages/processor/
COPY packages/notification/package*.json ./packages/notification/
COPY packages/email/package*.json ./packages/email/
COPY packages/auth/package*.json ./packages/auth/
COPY packages/manager/package*.json ./packages/manager/
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm install --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/monitor/dist ./packages/monitor/dist
COPY --from=builder /app/packages/processor/dist ./packages/processor/dist
COPY --from=builder /app/packages/notification/dist ./packages/notification/dist
COPY --from=builder /app/packages/email/dist ./packages/email/dist
COPY --from=builder /app/packages/auth/dist ./packages/auth/dist
COPY --from=builder /app/packages/manager/dist ./packages/manager/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/public ./apps/api/public

# Copy configuration files
COPY --from=builder /app/apps/api/config ./apps/api/config
COPY --from=builder /app/packages/processor/config ./packages/processor/config
COPY --from=builder /app/packages/monitor/config ./packages/monitor/config
COPY --from=builder /app/packages/manager/config ./packages/manager/config

# Copy operator scripts so the same image can run one-off init/smoke tasks.
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose port (Railway assigns PORT via env variable)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "apps/api/dist/index.js"]
