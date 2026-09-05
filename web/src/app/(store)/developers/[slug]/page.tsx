'use client';

import { use, useMemo } from 'react';
import Link from 'next/link';
import { developers } from '@/features/developers';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { DeveloperDetailContent } from '@/features/developers';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Developer } from '@/features/developers/model';
import type { Page, PublicMarketplaceSeller, PublicScriptSummary } from '@/types';
import { useI18n } from '@/i18n';

export default function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useI18n();

  // 1. Try local mock developer first
  const mockDeveloper = useMemo(
    () => developers.find((item) => item.slug.toLowerCase() === slug.toLowerCase()),
    [slug]
  );

  // 2. Fetch public seller from backend API (if not mock, or to support database sellers)
  const sellerResult = useFetch(
    () => api.get<PublicMarketplaceSeller>(`/store/sellers/${encodeURIComponent(slug)}`),
    `public-seller-${slug}`
  );

  // 3. Fetch public scripts
  const scriptsResult = useFetch(
    () => api.get<Page<PublicScriptSummary>>('/store/scripts?limit=50'),
    'developer-scripts',
  );

  // Build developer object
  const developer: Developer | null = useMemo(() => {
    if (mockDeveloper) return mockDeveloper;
    const apiSeller = sellerResult.data;
    if (!apiSeller) return null;

    return {
      slug: apiSeller.slug,
      name: apiSeller.displayName,
      headline: apiSeller.headline || t('seller.sellersLabel'),
      headlineVi: apiSeller.headline || t('seller.sellersLabel'),
      bio: apiSeller.headline || t('sellers.directoryLead'),
      bioVi: apiSeller.headline || t('sellers.directoryLead'),
      specialties: ['Automation', 'HideAuto'],
      avatar: apiSeller.avatarUrl || '/images/icon.png',
      products: apiSeller.statistics?.publishedScripts ?? 0,
      views: apiSeller.statistics?.views ?? 0,
      orders: apiSeller.statistics?.downloads ?? 0,
      rating: apiSeller.statistics?.ratingAvg ?? 5,
      reviewCount: apiSeller.statistics?.ratingCount ?? 0,
      joined: apiSeller.joinedAt
        ? new Date(apiSeller.joinedAt).toLocaleDateString('vi-VN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '01 Jan 2025',
      email: `contact@${apiSeller.slug}.dev`,
      phone: '',
      verified: apiSeller.verified,
    };
  }, [mockDeveloper, sellerResult.data, t]);

  const developerScripts = useMemo(() => {
    if (!developer) return [];
    return (scriptsResult.data?.items ?? []).filter(
      (script) =>
        script.seller.displayName.toLowerCase() === developer.name.toLowerCase(),
    );
  }, [developer, scriptsResult.data]);

  if (sellerResult.loading && !mockDeveloper) {
    return (
      <>
        <StoreHeader />
        <main className="shell section py-16 text-center" aria-busy="true">
          <p className="font-mono text-xs text-[var(--dim)] uppercase tracking-wider animate-pulse">
            {t('system.loadingCatalog')}
          </p>
        </main>
        <StoreFooter />
      </>
    );
  }

  if (!developer) {
    return (
      <>
        <StoreHeader />
        <main className="shell section py-16 text-center">
          <p className="label font-mono text-xs uppercase tracking-widest text-[var(--dim)] mb-2">
            {t('system.notFoundLabel')}
          </p>
          <h1 className="font-heading font-bold text-3xl uppercase text-[var(--ink)] mb-3">
            {t('system.notFoundTitle')}
          </h1>
          <p className="lead text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
            {t('system.notFoundLead')}
          </p>
          <Link
            href="/sellers"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {t('seller.viewAll')}
          </Link>
        </main>
        <StoreFooter />
      </>
    );
  }

  return (
    <>
      <StoreHeader />
      <DeveloperDetailContent
        developer={developer}
        developerScripts={developerScripts}
      />
      <StoreFooter />
    </>
  );
}
