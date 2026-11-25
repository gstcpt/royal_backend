# ==============================================================================
# ROYAL BACKEND — PRODUCTION MULTI-STAGE DOCKERFILE
# ==============================================================================

FROM node:24-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@10.15.0

# Copy workspace manifests, shared packages & Prisma schema first (layer cache)
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/packages ./apps/backend/packages
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/frontend/packages ./apps/frontend/packages

RUN pnpm install --no-frozen-lockfile

# Copy backend source & build
COPY apps/backend ./apps/backend

RUN pnpm --filter "@royal/shared-types" run build
RUN pnpm --filter "@royal/shared-validators" run build
RUN pnpm --filter "@royal/shared-utils" run build
RUN pnpm --filter backend run build

# Runner Stage
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --chown=node:node --from=builder /app ./
RUN mkdir -p /app/apps/backend/uploads && chown -R node:node /app/apps/backend/uploads

USER node
WORKDIR /app/apps/backend
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
