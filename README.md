# James Film

Portafolio web + panel de administración para James, creador de contenido audiovisual.
Reels y aftermovies verticales para bodas, XV años y eventos en Ayacucho, Perú.

Monorepo: `apps/api` (NestJS) · `apps/admin` (Next.js) · `apps/web` (Astro) · `packages/contracts`.

Contexto y decisiones: [`CLAUDE.md`](./CLAUDE.md).
El porqué de cada una: [`docs/proyecto.md`](./docs/proyecto.md).

## Arrancar

Requiere Node 24, pnpm 10 (`corepack enable`) y Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm --filter api db:migrate
pnpm --filter api db:seed

pnpm dev:api      # :3000
pnpm dev:admin    # :3001
pnpm dev:web      # :4321
```

## Comprobar

```bash
pnpm lint && pnpm typecheck && pnpm test
```
