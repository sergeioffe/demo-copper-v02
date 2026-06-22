# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install all workspace deps first (cache layer)
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/kb/package*.json ./packages/kb/
COPY packages/project-store/package*.json ./packages/project-store/
COPY packages/intelligence/package*.json ./packages/intelligence/
COPY server/package*.json ./server/
COPY apps/client/package*.json ./apps/client/

RUN npm ci
# Fix deprecated gtoken OAuth2 endpoint (gtoken 7.x hardcodes the old v4 URL)
RUN sed -i "s|https://www.googleapis.com/oauth2/v4/token|https://oauth2.googleapis.com/token|g" node_modules/gtoken/build/src/index.js

# Copy all source
COPY packages/ ./packages/
COPY server/ ./server/
COPY apps/client/ ./apps/client/
COPY tsconfig.json ./

# Build packages (contracts → kb/project-store/intelligence) then server
RUN npm run build --workspace=server

# Build client (Vite resolves @copper/contracts directly from source)
RUN npm run build --workspace=apps/client

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Only production server deps
COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY packages/kb/package*.json ./packages/kb/
COPY packages/project-store/package*.json ./packages/project-store/
COPY packages/intelligence/package*.json ./packages/intelligence/
COPY server/package*.json ./server/
RUN npm ci --omit=dev --workspace=server --include-workspace-root
# Fix deprecated gtoken OAuth2 endpoint (gtoken 7.x hardcodes the old v4 URL)
RUN sed -i "s|https://www.googleapis.com/oauth2/v4/token|https://oauth2.googleapis.com/token|g" node_modules/gtoken/build/src/index.js

# Compiled server + packages + runtime data files the server reads directly
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/fixtures ./server/fixtures
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/kb/dist ./packages/kb/dist
COPY --from=build /app/packages/project-store/dist ./packages/project-store/dist
COPY --from=build /app/packages/intelligence/dist ./packages/intelligence/dist

# Built client assets (served as static files by the server)
COPY --from=build /app/apps/client/dist ./apps/client/dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
