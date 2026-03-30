# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --ignore-scripts

# Copy source and build UI + server
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3132

# Install production dependencies only
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install --omit=dev --ignore-scripts

# Copy built output from build stage
COPY --from=build /app/dist ./dist

# server.ts is executed via tsx at runtime
COPY server.ts ./

EXPOSE 3132

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3132/health || exit 1

CMD ["npx", "tsx", "server.ts"]

