# ==============================================================================
# ROYAL BACKEND — PRODUCTION MULTI-STAGE DOCKERFILE
# ==============================================================================

FROM node:24-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10.15.0

# Copy Monorepo manifests & shared packages
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install & Build
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter "@royal/shared-types" run build
RUN pnpm --filter "@royal/shared-validators" run build
RUN pnpm --filter "@royal/shared-utils" run build
RUN pnpm --filter backend run prisma:generate
RUN pnpm --filter backend run build

# Runner Stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Security: non-root user
USER node

COPY --chown=node:node --from=builder /app ./

WORKDIR /app/apps/backend
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
