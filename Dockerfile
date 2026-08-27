# Link Mate production image for AWS App Runner.
# Node server artifact (Nitro node-server). Not a Vercel serverless bundle.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ARG LINKMATE_BUILD_COMMIT=unknown
ENV NITRO_PRESET=node-server
ENV VITE_AUTH_ENABLED=true
ENV VITE_GROK_BROKER=false
ENV NODE_ENV=production
ENV LINKMATE_BUILD_COMMIT=$LINKMATE_BUILD_COMMIT
RUN npm run build:aws

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ARG LINKMATE_BUILD_COMMIT=unknown
ENV NODE_ENV=production
ENV APP_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NITRO_PRESET=node-server
ENV AUTH_BROKER=off
ENV PAYMENTS_MODE=disabled
ENV MANUAL_PAYMENTS_ENABLED=true
ENV ENABLE_DEMO_NETWORK=false
ENV ENABLE_SAMPLE_DATA=false
ENV ENABLE_SIMULATE_JOINS=false
ENV ALLOW_BOOTSTRAP_ADMIN=false
ENV LINKMATE_BUILD_COMMIT=$LINKMATE_BUILD_COMMIT
RUN groupadd --system linkmate && useradd --system --gid linkmate --create-home linkmate
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/scripts/migration-plan.mjs ./scripts/migration-plan.mjs
COPY --from=build /app/scripts/docker-entrypoint.mjs ./scripts/docker-entrypoint.mjs
COPY --from=build /app/scripts/provision-admin.mjs ./scripts/provision-admin.mjs
USER linkmate
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["node", "scripts/docker-entrypoint.mjs"]
