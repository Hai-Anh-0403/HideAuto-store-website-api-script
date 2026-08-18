# Built from the repo root so the pnpm workspace files are in context:
#   docker build -f server/Dockerfile .
#
# Debian slim rather than alpine on purpose: bcrypt ships prebuilt glibc binaries and
# Prisma's engines expect openssl, so musl would mean compiling both from source.
FROM node:22-slim AS base
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── build ───────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter server...

COPY server/ server/
RUN pnpm --filter server exec prisma generate \
  && pnpm --filter server build

# ── runtime ─────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production

# Production-only install, then generate the Prisma client against this image's
# platform. `prisma` is a runtime dependency because the container applies the schema
# on startup.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --filter server... --prod

COPY server/prisma server/prisma
RUN pnpm --filter server exec prisma generate

COPY --from=build /app/server/dist server/dist

WORKDIR /app/server
EXPOSE 3001
# Apply the schema before serving so a fresh volume comes up ready.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
