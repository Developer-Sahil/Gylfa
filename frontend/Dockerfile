# ---- Stage 1: Builder ----
# Installs dependencies and produces a static production build
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached until package files change)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source and build
# Firebase env vars must be passed as --build-arg or via compose build.args
COPY . .
RUN GENERATE_SOURCEMAP=false npm run build

# ---- Stage 2: Runner ----
# Serves the static build via nginx — no Node.js in the final image
FROM nginx:1.27-alpine AS runner

# Copy compiled assets from builder
COPY --from=builder /app/build /usr/share/nginx/html

# Copy SPA-aware nginx config (handles client-side routing + gzip + caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
