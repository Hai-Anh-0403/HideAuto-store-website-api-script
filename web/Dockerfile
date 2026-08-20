# Built from the repo root so the pnpm workspace files are in context:
#   docker build -f web/Dockerfile .
FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ── build ───────────────────────────────────────────────────────────────
FROM base AS build
# Rewrites are baked into the build output, so the API origin has to be known here —
# setting it at runtime would have no effect.
ARG API_ORIGIN=http://server:3001
ENV API_ORIGIN=$API_ORIGIN
# Same deal: `NEXT_PUBLIC_*` is inlined into the bundle at build time. It only feeds
# `metadataBase`, so a wrong value costs absolute URLs in link previews, nothing more.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# Opt into `output: 'standalone'` — see the note in next.config.ts.
ENV BUILD_STANDALONE=1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter web...

COPY web/ web/
RUN pnpm --filter web build

# ── runtime ─────────────────────────────────────────────────────────────
# `output: 'standalone'` emits a server plus exactly the node_modules it traced, so the
# runtime image needs no package manager and no second install.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static web/.next/static

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "web/server.js"]
