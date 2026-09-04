'use client';

import { Suspense } from 'react';
import { CatalogBrowser } from '@/features/catalog';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { useI18n } from '@/i18n';

import { CatalogBrowserSkeleton } from '@/shared/ui/skeletons/catalog-browser-skeleton';

function CatalogHeader() {
  const { t } = useI18n();

  return (
    <>
      <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
        {t('catalog.label')}
      </p>
      <div className="heading mb-6 pb-3 border-b border-[var(--line)]">
        <div>
          <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl uppercase text-[var(--ink)] my-2">
            {t('catalog.title')}
          </h1>
          <p className="catalog-intro text-sm sm:text-base text-[var(--muted)] max-w-2xl leading-relaxed m-0">
            {t('catalog.intro')}
          </p>
        </div>
      </div>
    </>
  );
}

export default function ScriptsPage() {
  return (
    <>
      <a className="skip sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-3 focus:bg-[var(--steel)] focus:text-[var(--bg)]" href="#main">
        Skip to main content
      </a>
      <StoreHeader />
      <main id="main" className="shell section catalog-page py-8 md:py-12">
        <CatalogHeader />
        <Suspense fallback={<CatalogBrowserSkeleton />}>
          <CatalogBrowser />
        </Suspense>
      </main>
      <StoreFooter />
    </>
  );
}
