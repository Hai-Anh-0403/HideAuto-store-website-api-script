export interface CatalogScriptSeed {
  slug: string;
  name: string;
  outcome: string;
  runtime: string;
  price: string;
  version: string;
  updated: string;
  status: 'MAINTAINED' | 'POPULAR' | 'NEW';
  seller: string;
  category: 'Automation' | 'Data' | 'Operations';
  platform: 'Browser' | 'Web' | 'Files';
  views: number;
  watches: number;
  image: string;
  currency?: string;
}

export const scripts: CatalogScriptSeed[] = [
  {
    slug: 'session-pilot',
    name: 'Session Pilot',
    outcome: 'Reliable browser workflows with profile rotation.',
    runtime: 'Node 20+',
    price: '$39',
    version: '2.4.1',
    updated: '18 Jun 2026',
    status: 'MAINTAINED',
    seller: 'Northstar Automation',
    category: 'Automation',
    platform: 'Browser',
    views: 1220,
    watches: 186,
    image:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'catalog-watcher',
    name: 'Catalog Watcher',
    outcome: 'Track price, stock, and listing changes.',
    runtime: 'Python 3.11+',
    price: '$24',
    version: '1.8.0',
    updated: '12 Jun 2026',
    status: 'POPULAR',
    seller: 'Northstar Automation',
    category: 'Data',
    platform: 'Web',
    views: 980,
    watches: 230,
    image:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'invoice-extractor',
    name: 'Invoice Extractor',
    outcome: 'Normalize purchase records into clean CSV.',
    runtime: 'Node 18+',
    price: '$29',
    version: '3.1.2',
    updated: '07 Jun 2026',
    status: 'NEW',
    seller: 'Data Foundry',
    category: 'Data',
    platform: 'Files',
    views: 640,
    watches: 144,
    image:
      'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'release-notifier',
    name: 'Release Notifier',
    outcome: 'Monitor release pages and send precise change alerts.',
    runtime: 'Python 3.11+',
    price: '$19',
    version: '1.2.0',
    updated: '21 Jun 2026',
    status: 'NEW',
    seller: 'Signal Workshop',
    category: 'Operations',
    platform: 'Web',
    views: 510,
    watches: 173,
    image:
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'form-runner',
    name: 'Form Runner',
    outcome: 'Run repeatable form submissions with visible checkpoints.',
    runtime: 'Node 20+',
    price: '$34',
    version: '2.0.3',
    updated: '15 Jun 2026',
    status: 'MAINTAINED',
    seller: 'Northstar Automation',
    category: 'Automation',
    platform: 'Browser',
    views: 870,
    watches: 119,
    image:
      'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'document-sorter',
    name: 'Document Sorter',
    outcome: 'Classify incoming files and prepare structured folders.',
    runtime: 'Python 3.11+',
    price: '$17',
    version: '1.0.6',
    updated: '10 Jun 2026',
    status: 'POPULAR',
    seller: 'Data Foundry',
    category: 'Operations',
    platform: 'Files',
    views: 760,
    watches: 204,
    image:
      'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'listing-auditor',
    name: 'Listing Auditor',
    outcome: 'Check product listings for missing fields and anomalies.',
    runtime: 'Node 18+',
    price: '$27',
    version: '1.4.2',
    updated: '04 Jun 2026',
    status: 'MAINTAINED',
    seller: 'Signal Workshop',
    category: 'Data',
    platform: 'Web',
    views: 720,
    watches: 101,
    image:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'queue-keeper',
    name: 'Queue Keeper',
    outcome: 'Turn recurring operational queues into tracked daily runs.',
    runtime: 'Node 20+',
    price: '$22',
    version: '1.1.0',
    updated: '20 Jun 2026',
    status: 'NEW',
    seller: 'Northstar Automation',
    category: 'Automation',
    platform: 'Browser',
    views: 430,
    watches: 154,
    image:
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'log-analyzer',
    name: 'Log Analyzer',
    outcome: 'Aggregate and parse application log streams into daily metric summaries.',
    runtime: 'Python 3.11+',
    price: '$21',
    version: '1.0.2',
    updated: '23 Jun 2026',
    status: 'NEW',
    seller: 'Signal Workshop',
    category: 'Operations',
    platform: 'Files',
    views: 380,
    watches: 88,
    image:
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'webhook-bridge',
    name: 'Webhook Bridge',
    outcome: 'Relay and sanitize incoming webhooks to multiple internal endpoints.',
    runtime: 'Node 20+',
    price: '$32',
    version: '2.1.0',
    updated: '24 Jun 2026',
    status: 'MAINTAINED',
    seller: 'Data Foundry',
    category: 'Automation',
    platform: 'Web',
    views: 590,
    watches: 132,
    image:
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'asset-optimizer',
    name: 'Asset Optimizer',
    outcome: 'Compress images and convert web assets automatically before release.',
    runtime: 'Node 18+',
    price: '$18',
    version: '1.3.1',
    updated: '25 Jun 2026',
    status: 'POPULAR',
    seller: 'Northstar Automation',
    category: 'Operations',
    platform: 'Files',
    views: 890,
    watches: 195,
    image:
      'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
  },
  {
    slug: 'inventory-syncer',
    name: 'Inventory Syncer',
    outcome: 'Sync multi-store inventory counts across platforms in real time.',
    runtime: 'Python 3.11+',
    price: '$45',
    version: '3.0.0',
    updated: '26 Jun 2026',
    status: 'MAINTAINED',
    seller: 'Signal Workshop',
    category: 'Data',
    platform: 'Web',
    views: 1100,
    watches: 240,
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
  },
];
