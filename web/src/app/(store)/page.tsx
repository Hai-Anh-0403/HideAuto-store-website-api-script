'use client';

import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { AdSlot } from '@/features/advertising';
import { ScriptListItem } from '@/features/catalog';
import { developers, SellerSummaryCard } from '@/features/developers';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { useI18n, type MessageKey } from '@/i18n';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { ScriptListItemSkeleton } from '@/shared/ui/skeletons/script-list-item-skeleton';
import type { Page, PublicScriptSummary } from '@/types';

const deliverySteps = [
  {
    num: '01',
    titleKey: 'home.deliveryStep1Title' as const,
    descKey: 'home.deliveryStep1Desc' as const,
  },
  {
    num: '02',
    titleKey: 'home.deliveryStep2Title' as const,
    descKey: 'home.deliveryStep2Desc' as const,
  },
  {
    num: '03',
    titleKey: 'home.deliveryStep3Title' as const,
    descKey: 'home.deliveryStep3Desc' as const,
  },
];

function ScriptRail({
  label,
  titleKey,
  sort,
}: {
  label: string;
  titleKey: MessageKey;
  sort: 'views' | 'newest' | 'popular' | 'updated';
}) {
  const { t } = useI18n();
  const result = useFetch(
    () => api.get<Page<PublicScriptSummary>>(`/store/scripts?sort=${sort}&limit=6`),
    `rail-${sort}`,
  );

  const items = result.data?.items ?? [];

  return (
    <section className="shell section script-rail py-10 md:py-14">
      <div className="heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8 pb-3 border-b border-[var(--line)]">
        <div>
          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
            {label} / {t('home.discoverScripts')}
          </p>
          <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl uppercase text-[var(--ink)] m-0">
            {t(titleKey)}
          </h2>
        </div>
        <Link
          href={`/scripts?sort=${sort}`}
          className="inline-flex items-center gap-1.5 font-heading font-semibold text-sm text-[var(--steel)] hover:translate-x-1 transition-transform"
        >
          {t('common.viewAll')} <ArrowRight size={15} />
        </Link>
      </div>
      <div className="script-list-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {result.loading ? (
          Array.from({ length: 3 }).map((_, i) => <ScriptListItemSkeleton key={i} />)
        ) : items.length > 0 ? (
          items.map((script) => (
            <ScriptListItem key={script.id} script={script} />
          ))
        ) : (
          <p className="col-span-full text-xs font-mono text-[var(--dim)] py-6">
            {t('catalog.noMatchDescription')}
          </p>
        )}
      </div>
    </section>
  );
}

export default function Page() {
  const { t } = useI18n();

  const heroFeatured = useFetch(
    () => api.get<Page<PublicScriptSummary>>('/store/scripts?sort=popular&limit=4'),
    'hero-featured',
  );

  return (
    <>
      <a className="skip sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-3 focus:bg-[var(--steel)] focus:text-[var(--bg)]" href="#main">
        Skip to main content
      </a>
      <StoreHeader />
      <main id="main">
        <section className="shell hero py-8 md:py-12">
          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-3">
            01 / {t('home.scriptMarketplace')}
          </p>
          <div className="hero-grid grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8 lg:gap-12 p-6 md:p-10 bg-[var(--panel)] border border-[var(--line)]">
            <div className="flex flex-col justify-between">
              <div>
                <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--steel)] font-semibold mb-2">
                  {t('home.automationDirectContact')}
                </p>
                <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl uppercase leading-tight text-[var(--ink)] my-3">
                  {t('home.heroLineOne')}
                  <br />
                  {t('home.heroLineTwo')}{' '}
                  <em className="not-italic text-[var(--steel)]">{t('home.heroEmphasis')}</em>
                </h1>
                <p className="lead text-sm sm:text-base text-[var(--muted)] max-w-xl leading-relaxed my-4">
                  {t('home.heroLead')}
                </p>
              </div>
              <div className="actions mt-4 pt-4 border-t border-[var(--line)]">
                <Link
                  className="primary inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-base hover:opacity-90 transition-opacity"
                  href="/scripts"
                >
                  {t('common.browseScripts')} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className="hero-featured flex flex-col gap-4 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[var(--line)] lg:pl-8">
              <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
                {t('home.featuredScripts')}
              </p>
              {heroFeatured.loading ? (
                Array.from({ length: 2 }).map((_, i) => <ScriptListItemSkeleton key={i} />)
              ) : heroFeatured.data?.items.length ? (
                heroFeatured.data.items.slice(0, 4).map((script, index) => (
                  <ScriptListItem
                    key={script.id}
                    script={script}
                    priority={index < 2}
                  />
                ))
              ) : (
                <p className="text-xs font-mono text-[var(--dim)] my-4">
                  {t('catalog.noMatchDescription')}
                </p>
              )}
            </div>
          </div>
        </section>

        <ScriptRail label="02" titleKey="catalog.topViews" sort="views" />
        <div className="shell my-6">
          <AdSlot slotId="home-after-top-views" />
        </div>
        <ScriptRail label="03" titleKey="catalog.newest" sort="newest" />
        <div className="shell my-6">
          <AdSlot slotId="home-between-rails" />
        </div>
        <ScriptRail label="04" titleKey="catalog.mostWatched" sort="popular" />
        <ScriptRail label="05" titleKey="catalog.recentlyUpdated" sort="updated" />

        <section className="shell section script-rail py-10 md:py-14" id="hideauto-scripts">
          <div className="heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8 pb-3 border-b border-[var(--line)]">
            <div>
              <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
                06 / {t('home.hideAutoScripts')}
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl uppercase text-[var(--ink)] m-0">
                {t('home.hideAutoScriptsTitle')}
              </h2>
            </div>
            <Link
              href="/scripts"
              className="inline-flex items-center gap-1.5 font-heading font-semibold text-sm text-[var(--steel)] hover:translate-x-1 transition-transform"
            >
              {t('home.viewAllHideAutoScripts')} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="script-list-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {heroFeatured.loading ? (
              Array.from({ length: 3 }).map((_, i) => <ScriptListItemSkeleton key={i} />)
            ) : heroFeatured.data?.items.length ? (
              heroFeatured.data.items.map((script) => (
                <ScriptListItem key={script.id} script={script} />
              ))
            ) : (
              <p className="col-span-full text-xs font-mono text-[var(--dim)] py-6">
                {t('catalog.noMatchDescription')}
              </p>
            )}
          </div>
        </section>

        <section className="shell section py-10 md:py-14" id="developers">
          <div className="heading flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8 pb-3 border-b border-[var(--line)]">
            <div>
              <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
                07 / {t('home.community')}
              </p>
              <h2 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl uppercase text-[var(--ink)] m-0">
                {t('home.featuredSellersTitle')}
              </h2>
            </div>
            <Link
              href="/developers"
              className="inline-flex items-center gap-1.5 font-heading font-semibold text-sm text-[var(--steel)] hover:translate-x-1 transition-transform"
            >
              {t('seller.viewAll')} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="seller-summary-grid grid grid-cols-1 md:grid-cols-3 border-t border-l border-[var(--line)]">
            {developers.slice(0, 3).map((seller) => (
              <SellerSummaryCard key={seller.slug} seller={seller} />
            ))}
          </div>
        </section>

        <section className="shell delivery grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-8 lg:gap-12 p-6 md:p-10 bg-[#2c455d] dark:bg-[#1a2634] text-[#eef6ff] mb-16 border border-white/10" id="docs">
          <div>
            <p className="label font-mono text-[10px] uppercase tracking-widest text-[#b5d9fd] dark:text-[#8bb5e0] mb-2">
              08 / {t('home.clearDelivery')}
            </p>
            <h2 className="font-heading font-bold text-3xl sm:text-4xl uppercase text-white my-2">
              {t('home.afterContactTitle')}
            </h2>
          </div>
          <ol className="list-none m-0 p-0 divide-y divide-white/20">
            {deliverySteps.map(({ num, titleKey, descKey }) => (
              <li key={num} className="grid grid-cols-[42px_1fr_auto] gap-3 py-4 first:pt-0 last:pb-0 items-start">
                <span className="font-mono text-[10px] text-[#b5d9fd] dark:text-[#8bb5e0] pt-1">{num}</span>
                <div>
                  <h3 className="font-heading font-semibold text-lg uppercase text-white m-0 mb-1">{t(titleKey)}</h3>
                  <p className="text-sm text-[#d6ebff] dark:text-[#c0d8f0] m-0 leading-relaxed">{t(descKey)}</p>
                </div>
                <Check size={17} className="text-[#b5d9fd] dark:text-[#8bb5e0] mt-1 shrink-0" />
              </li>
            ))}
          </ol>
        </section>

        <div className="shell footer-ad my-6">
          <AdSlot slotId="home-footer" />
        </div>
      </main>
      <StoreFooter />
    </>
  );
}

