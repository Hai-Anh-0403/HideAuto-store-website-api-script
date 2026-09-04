'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, Star } from 'lucide-react';
import type { Developer } from '@/features/developers/model';
import type { PublicScriptSummary } from '@/types';
import type { CatalogScript } from '@/features/catalog/data';
import { ScriptListItem } from '@/features/catalog/script-list-item';
import { useI18n } from '@/i18n';
import { BackButton } from '@/shared/ui/back-button';

export function DeveloperDetailContent({
  developer,
  developerScripts,
}: {
  developer: Developer;
  developerScripts: (PublicScriptSummary | CatalogScript)[];
}) {

  const { locale, t } = useI18n();
  const isVi = locale === 'vi';

  return (
    <main className="shell section developer-page py-8 md:py-12">
      <div className="back-button-wrapper mb-4">
        <BackButton fallbackHref="/developers" />
      </div>
      <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-4">
        <Link href="/developers" className="hover:text-[var(--steel)]">{t('seller.sellersLabel')}</Link> /{' '}
        {developer.name.toUpperCase()}
      </p>
      <div className="developer-profile max-w-3xl pb-8 mb-8 border-b border-[var(--line)]">
        <div className="developer-profile__header grid grid-cols-1 sm:grid-cols-[128px_minmax(0,1fr)] gap-6 items-start mb-6">
          <Image
            className="developer-profile__avatar w-[128px] h-[128px] object-cover border border-[var(--line)]"
            src={developer.avatar}
            alt={`${developer.name} seller profile`}
            width={128}
            height={128}
            priority
          />
          <div>
            <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--steel)] font-semibold mb-2">{t('seller.featuredBadge')}</p>
            <h1 className="font-heading font-bold text-3xl sm:text-4xl uppercase text-[var(--ink)] my-1 flex items-center flex-wrap gap-2">
              {developer.name}
              {developer.verified && (
                <span className="developer-verified inline-grid w-4 h-4 place-items-center rounded-full bg-[var(--steel)] text-[var(--bg)] font-bold text-[11px]">
                  <span aria-hidden="true">✓</span>
                  <span className="sr-only">{t('common.verifiedSeller')}</span>
                </span>
              )}
            </h1>
            <p className="lead text-base text-[var(--muted)] my-2">
              {isVi ? developer.headlineVi : developer.headline}
            </p>
            <div className="developer-profile__stats flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] my-3 font-mono">
              <span className="inline-flex items-center gap-1 text-[var(--steel)]">
                <Star size={15} fill="currentColor" /> {developer.rating} (
                {developer.reviewCount})
              </span>
              <span>
                <b className="text-[var(--ink)]">{developer.products}</b> {t('seller.products')}
              </span>
              <span>
                <b className="text-[var(--ink)]">{developer.views.toLocaleString('en-US')}</b>{' '}
                {t('seller.views')}
              </span>
              <span>
                <b className="text-[var(--ink)]">{developer.orders}</b> {t('seller.orders')}
              </span>
            </div>
            <p className="developer-profile__contact flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--muted)] my-2">
              <span className="inline-flex items-center gap-1">
                <Mail size={15} className="text-[var(--steel)]" /> {developer.email}
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone size={15} className="text-[var(--steel)]" /> {developer.phone}
              </span>
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed my-4">{isVi ? developer.bioVi : developer.bio}</p>
        <div className="tags flex flex-wrap gap-2 my-4">
          {developer.specialties.map((specialty) => (
            <span key={specialty} className="px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]">{specialty}</span>
          ))}
        </div>
      </div>
      <div className="heading flex items-end justify-between mb-6 pb-3 border-b border-[var(--line)]">
        <div>
          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">{t('seller.releases')}</p>
          <h2 className="font-heading font-bold text-3xl uppercase text-[var(--ink)] m-0">{t('seller.releasesTitle', { name: developer.name })}</h2>
        </div>
      </div>
      {developerScripts.length ? (
        <div className="catalog-list grid grid-cols-1 md:grid-cols-2 gap-4">
          {developerScripts.map((script) => (
            <ScriptListItem key={'id' in script ? script.id : script.slug} script={script} />
          ))}
        </div>
      ) : (
        <div className="catalog-empty p-8 text-center bg-[var(--panel)] border border-[var(--line)] my-6">
          <h2 className="font-heading font-bold text-2xl uppercase text-[var(--ink)] mb-2">{t('seller.noReleasesTitle')}</h2>
          <p className="text-sm text-[var(--muted)] mb-4">{t('seller.noReleasesDesc')}</p>
          <Link className="secondary inline-flex items-center gap-2 px-4 py-2 border border-[var(--line)] text-sm font-heading uppercase text-[var(--ink)] hover:border-[var(--steel)]" href="/scripts">
            {t('common.browseScripts')}
          </Link>
        </div>
      )}
    </main>
  );
}
