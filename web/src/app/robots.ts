import type { MetadataRoute } from 'next'

/**
 * Generates `/robots.txt`.
 *
 * Everything worth reading here is behind a login, so the useful job is the opposite of
 * the usual one: keep crawlers out of the portal and the admin console. Those routes
 * also send `noindex` from their own layouts — robots.txt stops the fetch, the header
 * stops an already-known URL from staying in the index, and neither covers the other.
 *
 * `/api/*` is a rewrite to the NestJS server; it answers JSON and 401s, never HTML.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/portal/', '/admin/', '/api/'],
      },
    ],
  }
}
