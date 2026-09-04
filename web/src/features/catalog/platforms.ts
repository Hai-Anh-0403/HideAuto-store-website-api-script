export const scriptPlatforms: Record<string, string[]> = {
  'session-pilot': ['Facebook', 'Instagram'],
  'catalog-watcher': ['Shopee', 'Lazada'],
  'invoice-extractor': ['TikTok Shop', 'Marketplace'],
  'release-notifier': ['YouTube', 'TikTok'],
  'form-runner': ['Facebook', 'TikTok'],
  'document-sorter': ['Google Drive', 'Marketplace'],
  'listing-auditor': ['Shopee', 'Lazada'],
  'queue-keeper': ['Facebook', 'YouTube'],
  'log-analyzer': ['Google Drive', 'Marketplace'],
  'webhook-bridge': ['Facebook', 'Shopee'],
  'asset-optimizer': ['TikTok', 'Instagram'],
  'inventory-syncer': ['Shopee', 'Lazada'],
};

export function platformsForScript(slug: string) {
  return scriptPlatforms[slug] ?? [];
}

export function platformLabel(slug: string) {
  return platformsForScript(slug).join(' · ') || 'Multi-platform';
}
