# ── Stage 1: Build React/TypeScript Application ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Clean install dependencies
RUN npm ci

# Copy application source
COPY . .

# Set production API URL build arg (can be overridden at build time)
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Build optimized static distribution
RUN npm run build

# ── Stage 2: Production Nginx Static Server ──────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx configurations
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom hardened nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
