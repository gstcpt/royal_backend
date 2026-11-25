# Royal Backend API (`apps/backend`)

> API REST **NestJS 11** + **Prisma ORM 6** + **PostgreSQL 17** de la plateforme **Royal — Electro de Maison**.

---

## ⚙️ Stack & Architecture

- **Runtime** : Node.js **24.x**, `pnpm@10.15.0`, TypeScript `5.7`
- **Framework** : NestJS 11 ([`src/main.ts`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/src/main.ts), [`src/app.module.ts`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/src/app.module.ts))
- **ORM & Base** : Prisma 6 ([`prisma/schema.prisma`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/prisma/schema.prisma) — **71 modèles**, **19 enums**)
- **Sécurité** : Argon2id, JWT Access (15 min) + Refresh Rotation (7 j), `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` (support `permA|permB`), `AuditInterceptor` (masquage des secrets), Helmet, Throttler (`100` req/60s), body limit `25mb`
- **Documentation API** : Swagger UI sur `/api/v1/docs` (`http://localhost:4000/api/v1/docs`)
- **Packages internes vendorisés** : `@royal/shared-types`, `@royal/shared-utils`, `@royal/shared-validators` sous [`apps/backend/packages/`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/packages)

---

## 📦 20 Modules Métier (`src/modules/`, `21` Contrôleurs)

- **Identité & Gouvernance** : `auth`, `users`, `roles`, `permissions`, `audit-logs`, `health`
- **Catalogue & Achats** : `brands`, `categories`, `characteristics`, `variants`, `products`, `suppliers`, `coupons`
- **Stock & Logistique** : `warehouses`, `inventory`, `stock-transfers`
- **Ventes, POS & CMS** : `cart`, `orders`, `pos`, `storefront-cms` (`StorefrontCmsController` + `CustomersController` : CMS 8 vues, `sys-config`, `visibility`, `roleViews`, télémétrie `TrafficEvent`, rapports live `analytics`/`sales`/`treasury`, stockage NVMe/R2/Cloudinary, Flouci, SMTP+PDF pur Node, IA Gemini/Groq Worker loop)

---

## 🌐 Environnements & Fichiers `.env`

| Fichier | Usage | Suivi Git |
| :--- | :--- | :---: |
| [`.env`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/.env) | Développement local Windows PG17 (`localhost:5432/royal`) | ❌ Ignoré |
| [`.env.vps`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/.env.vps) | Production VPS Oxahost (`/opt/royal/backend/.env`, `127.0.0.1:5432`) | ❌ Ignoré |
| [`.env.vps.example`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/.env.vps.example) | Modèle sûr pour configuration VPS `/opt/royal/backend/.env` | ✅ Trackable |
| [`.env.neon`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/.env.neon) | Connexion Neon PostgreSQL (archive démo / `--neon`) | ❌ Ignoré |
| [`.env.vercel`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/.env.vercel) | Variables serverless Vercel (archive démo) | ❌ Ignoré |

- Validation stricte au démarrage dans [`src/config/env.validation.ts`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/src/config/env.validation.ts) (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` requis).

---

## 🐳 Docker & Commandes

```bash
# Depuis apps/backend/
pnpm dev                # Nest watch mode (:4000)
pnpm build              # prisma generate && nest build -> dist/src/main.js
pnpm type-check         # tsc --noEmit
pnpm start:prod         # node dist/src/main
pnpm prisma:generate    # Génère Prisma Client
npx ts-node prisma/sync-marketing-role.ts  # Sync idempotente rôle MARKETING (65 perms)
```

- **Docker Local (`royal_backend`)** : [`Dockerfile.dev`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/Dockerfile.dev) via [`docker-compose.yml`](file:///e:/ToUse/BSofts/ecommerce/docker-compose.yml) (volume uploads monté sur `/app/apps/backend/uploads`).
- **Docker Production** : [`Dockerfile`](file:///e:/ToUse/BSofts/ecommerce/apps/backend/Dockerfile) multi-stage Node 24 Alpine non-root (`node`, port `4000`).
