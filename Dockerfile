FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Compile TypeScript files
RUN npx tsc -p scripts/tsconfig.json

# Create logs directory with proper permissions
RUN mkdir -p logs && chmod 755 logs

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev --legacy-peer-deps

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S digestbot -u 1001 -G nodejs && \
    chown -R digestbot:nodejs /app

USER digestbot

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# Run the continuous script
CMD ["node", "scripts/dist/scripts/digest/run-continuous.js"] 