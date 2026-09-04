import type { NextConfig } from 'next'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The browser always talks to same-origin `/api/*`; Next proxies it to the NestJS server.
 *
 * NOTE: rewrites are compiled into `routes-manifest.json` at **build** time, so this is a
 * build-time value — the Docker image takes it as a build arg, not a runtime env var.
 * Local dev: http://localhost:3001 · compose: http://server:3001
 */
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001'

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  // Hide the floating Next.js dev overlay/logo in the corner during `next dev`.
  devIndicators: false,
  // Self-contained server bundle, but only when the Docker build asks for it: tracing
  // pnpm's linked deps needs symlinks, which a non-elevated Windows build can't create.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,
  // Trace from the workspace root so pnpm's linked dependencies are included, and Next
  // doesn't walk further up and latch onto an unrelated lockfile.
  outputFileTracingRoot: join(here, '..'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ]
  },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }]
  },
}

export default config
