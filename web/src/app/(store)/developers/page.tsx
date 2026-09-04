'use client';

import { Suspense } from 'react';
import { DeveloperDirectory } from '@/features/developers';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { useI18n } from '@/i18n';

export default function DevelopersPage() {
  const { t } = useI18n();

  return (
    <>
      <StoreHeader />
      <main className="shell section developer-directory-page py-8 md:py-12">
        <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
          {t('sellers.directoryLabel')}
        </p>
        <div className="heading mb-6 pb-3 border-b border-[var(--line)]">
          <div>
            <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl uppercase text-[var(--ink)] my-2">
              {t('sellers.directoryTitle')}
            </h1>
            <p className="catalog-intro text-sm sm:text-base text-[var(--muted)] max-w-2xl leading-relaxed m-0">
              {t('sellers.directoryLead')}
            </p>
          </div>
        </div>
        <Suspense fallback={<div className="developer-cards flex flex-col gap-4 mb-8" />}>
          <DeveloperDirectory />
        </Suspense>
      </main>
      <StoreFooter />
    </>
  );
}
