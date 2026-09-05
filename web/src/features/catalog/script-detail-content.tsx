'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Check, MessageCircle, Star, Eye, History, ShieldAlert } from 'lucide-react';
import { AdSlot } from '@/features/advertising/ad-slot';
import type { PublicScriptDetail, PublicScriptSummary } from '@/types';
import { ScriptListItem } from '@/features/catalog/script-list-item';
import { useI18n } from '@/i18n';
import { BackButton } from '@/shared/ui/back-button';

export function ScriptDetailContent({
  script,
  relatedScripts = [],
}: {
  script: PublicScriptDetail;
  relatedScripts?: PublicScriptSummary[];
}) {
  const { t } = useI18n();

  const thumbnail = script.thumbnailUrl ?? '/images/icon.png';
  const externalThumbnail = /^https?:\/\//i.test(thumbnail);
  const rating = (script.statistics?.ratingAvg ?? 0) > 0 ? script.statistics.ratingAvg.toFixed(1) : null;
  const capabilities = script.capabilities ?? [];
  const galleryUrls = script.galleryUrls ?? [];
  const tags = script.tags ?? [];
  const versions = script.versions ?? [];
  const usesShell = capabilities.includes('uses_shell');

  return (
    <main className="shell section py-8 md:py-12">
      <div className="back-button-wrapper mb-4">
        <BackButton fallbackHref="/scripts" />
      </div>

      <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-4">
        <Link href="/scripts" className="hover:text-[var(--steel)]">
          {t('script.scriptsLabel')}
        </Link>{' '}
        / {script.name.toUpperCase()}
      </p>

      <div className="hero-grid grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--steel)] font-semibold">
              VERSION {script.latestApprovedVersion}
            </span>
            {usesShell && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono text-[9px] uppercase tracking-wider">
                <ShieldAlert size={12} /> {t('cap.shell')}
              </span>
            )}
          </div>

          <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl uppercase text-[var(--ink)] my-2 leading-tight">
            {script.name}
          </h1>

          <p className="lead text-base text-[var(--muted)] leading-relaxed my-3">
            {script.shortDescription}
          </p>

          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-4">
            {t('script.sellerLabel')}{' '}
            <span className="text-[var(--steel)] font-semibold">
              {script.seller.displayName.toUpperCase()}
            </span>{' '}
            / {t('script.verifiedProfile')}
          </p>

          <figure className="detail-media relative h-[240px] sm:h-[360px] my-6 overflow-hidden bg-[var(--panel)] border border-[var(--line)]">
            <Image
              src={thumbnail}
              alt={`Preview for ${script.name}`}
              width={1200}
              height={675}
              priority
              unoptimized={externalThumbnail}
              onError={(event) => {
                event.currentTarget.srcset = '';
                event.currentTarget.src = '/images/icon.png';
              }}
              sizes="(max-width: 760px) 100vw, (max-width: 1200px) 80vw, 800px"
              className="w-full h-full object-cover filter saturate-75 contrast-105"
            />
            <figcaption className="absolute right-0 bottom-0 px-3 py-1.5 bg-[var(--bg)]/90 text-[var(--steel)] font-mono text-[10px] tracking-wider uppercase border-t border-l border-[var(--line)]">
              {t('script.previewTitle')}
            </figcaption>
          </figure>

          {galleryUrls.length > 0 && (
            <div className="gallery-grid grid grid-cols-3 gap-3 my-4">
              {galleryUrls.map((url, idx) => (
                <div key={idx} className="relative aspect-video overflow-hidden border border-[var(--line)] bg-[var(--panel)]">
                  <Image
                    src={url}
                    alt={`${script.name} gallery image ${idx + 1}`}
                    fill
                    unoptimized={/^https?:\/\//i.test(url)}
                    onError={(event) => {
                      event.currentTarget.srcset = '';
                      event.currentTarget.src = '/images/icon.png';
                    }}
                    sizes="(max-width: 760px) 33vw, 240px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          <h2 className="font-heading font-bold text-2xl uppercase text-[var(--ink)] mt-6 mb-2">
            {t('script.builtForRepeatableTitle')}
          </h2>
          <p className="lead text-sm text-[var(--muted)] leading-relaxed my-3">
            {t('script.builtForRepeatableLead')}
          </p>

          <div className="tags flex flex-wrap gap-2 my-4">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]"
              >
                {tag.name}
              </span>
            ))}
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--steel)]"
              >
                {cap}
              </span>
            ))}
            <span className="px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]">
              {t('script.sourceExamples')}
            </span>
            <span className="px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)]">
              {t('script.updatesPeriod')}
            </span>
          </div>

          {script.descriptionHtml && (
            <div
              className="prose dark:prose-invert max-w-none text-sm text-[var(--muted)] leading-relaxed my-6 p-4 bg-[var(--panel)] border border-[var(--line)]"
              dangerouslySetInnerHTML={{ __html: script.descriptionHtml }}
            />
          )}
        </section>

        <aside className="purchase p-5 bg-[var(--panel)] border border-[var(--line)] h-fit">
          <div className="price-box mb-4 pb-4 border-b border-[var(--line)] flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--dim)]">
              {t('common.startingPrice')}
            </span>
            <span className="font-heading font-bold text-3xl text-[var(--steel)]">
              {script.price || '$29'}
            </span>
          </div>

          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
            {t('home.automationDirectContact')}
          </p>
          <strong className="block font-heading font-bold text-2xl uppercase text-[var(--ink)] my-2">
            {script.seller.displayName}
          </strong>
          <p className="text-xs text-[var(--muted)] my-3 leading-relaxed">
            {t('script.agreeTermsNotice')}
          </p>

          <div className="stats-box p-3 bg-[var(--bg)] border border-[var(--line)] my-3 font-mono text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between text-[var(--dim)]">
              <span>{t('seller.views')}</span>
              <span className="text-[var(--ink)] font-semibold inline-flex items-center gap-1">
                <Eye size={12} /> {script.statistics.views.toLocaleString()}
              </span>
            </div>
            {rating && (
              <div className="flex items-center justify-between text-[var(--dim)]">
                <span>Rating</span>
                <span className="text-[var(--ink)] font-semibold inline-flex items-center gap-1">
                  <Star size={12} fill="currentColor" className="text-[var(--steel)]" /> {rating} ({script.statistics.ratingCount})
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[var(--dim)]">
              <span>{t('script.versionLabel')}</span>
              <span className="text-[var(--ink)] font-semibold">v{script.latestApprovedVersion}</span>
            </div>
          </div>

          <Link
            className="primary contact-link w-full mt-4 py-3 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-base flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            href={`/contact?script=${script.slug}`}
          >
            <MessageCircle size={16} /> {t('seller.contact')}
          </Link>
          <small className="flex items-center gap-1.5 text-xs text-[var(--dim)] mt-4">
            <Check size={14} className="text-[var(--steel)]" /> {t('script.typicalReply')}
          </small>
        </aside>
      </div>

      <section className="script-detail-info grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr] gap-8 my-10 py-8 border-y border-[var(--line)]">
        <div>
          <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
            {t('script.productDetailsLabel')}
          </p>
          <h2 className="font-heading font-bold text-3xl uppercase text-[var(--ink)] my-2">
            {t('script.clearReqTitle')}
          </h2>
          <p className="lead text-sm text-[var(--muted)] leading-relaxed m-0">
            {t('script.clearReqLead')}
          </p>
        </div>

        <dl className="script-detail-facts grid grid-cols-1 sm:grid-cols-2 border-t border-l border-[var(--line)] m-0">
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('script.versionLabel')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mt-1 m-0">
              {script.latestApprovedVersion}
            </dd>
          </div>
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('common.startingPrice')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--steel)] mt-1 m-0">
              {script.price || '$29'}
            </dd>
          </div>
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('script.lastUpdatedLabel')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mt-1 m-0" suppressHydrationWarning>
              {new Date(script.updatedAt).toLocaleDateString()}
            </dd>
          </div>
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('seller.views')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mt-1 m-0">
              {script.statistics.views.toLocaleString()}
            </dd>
          </div>
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('script.sellerLabel')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mt-1 m-0">
              {script.seller.displayName}
            </dd>
          </div>
          <div className="p-4 border-r border-b border-[var(--line)]">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[var(--dim)]">
              {t('script.supportLabel')}
            </dt>
            <dd className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mt-1 m-0">
              {t('script.directSellerSupport')}
            </dd>
          </div>
        </dl>
      </section>

      {versions.length > 0 && (
        <section className="script-version-history py-6 border-b border-[var(--line)]">
          <div className="flex items-center gap-2 mb-4">
            <History size={16} className="text-[var(--steel)]" />
            <h3 className="font-heading font-bold text-xl uppercase text-[var(--ink)] m-0">
              Release History
            </h3>
          </div>
          <div className="space-y-3">
            {versions.map((ver) => (
              <div key={ver.id} className="p-3 bg-[var(--panel)] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-[var(--ink)]">v{ver.version}</span>
                  {ver.changelog && (
                    <p className="text-xs text-[var(--muted)] m-0 mt-1">{ver.changelog}</p>
                  )}
                </div>
                <time className="font-mono text-[10px] text-[var(--dim)] shrink-0" suppressHydrationWarning>
                  {new Date(ver.releasedAt ?? ver.createdAt).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="script-detail-includes py-6 border-b border-[var(--line)]">
        <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-3">
          {t('script.whatsIncludedLabel')}
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4 list-none m-0 p-0">
          <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
            <Check size={17} className="text-[var(--steel)] shrink-0 mt-0.5" />
            {t('script.incSourceFiles')}
          </li>
          <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
            <Check size={17} className="text-[var(--steel)] shrink-0 mt-0.5" />
            {t('script.incDoc')}
          </li>
          <li className="flex items-start gap-2 text-sm text-[var(--muted)]">
            <Check size={17} className="text-[var(--steel)] shrink-0 mt-0.5" />
            {t('script.incUpdates')}
          </li>
        </ul>
      </section>

      <AdSlot slotId="script-detail-after-description" />

      {relatedScripts.length > 0 && (
        <section className="script-recommendations pt-10">
          <div className="heading flex items-end justify-between mb-6 pb-3 border-b border-[var(--line)]">
            <div>
              <p className="label font-mono text-[10px] uppercase tracking-widest text-[var(--dim)] mb-1">
                {t('script.relatedScriptsLabel')}
              </p>
              <h2 className="font-heading font-bold text-3xl uppercase text-[var(--ink)] m-0">
                {t('script.relatedScriptsTitle')}
              </h2>
            </div>
            <Link
              href="/scripts"
              className="font-heading font-semibold text-sm text-[var(--steel)] hover:underline"
            >
              {t('common.viewAll')}
            </Link>
          </div>
          <div className="script-list-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {relatedScripts.map((item) => (
              <ScriptListItem key={item.id} script={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
