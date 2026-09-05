'use client';

import Link from 'next/link';
import { ArrowRight, Send, Star } from 'lucide-react';
import type { PublicMarketplaceSeller } from '@/types';
import { useI18n } from '@/i18n';

export function PublicSellerSummaryCard({
  seller,
  showContact = false,
}: {
  seller: PublicMarketplaceSeller;
  showContact?: boolean;
}) {
  const { t } = useI18n();

  return (
    <article
      className={`seller-summary-card grid ${
        showContact
          ? 'grid-cols-1 sm:grid-cols-[88px_minmax(0,1fr)_auto] items-center border border-[var(--line)]'
          : 'grid-cols-[88px_minmax(0,1fr)] border-r border-b border-[var(--line)]'
      } gap-4 p-5 bg-[var(--panel)] hover:border-[var(--steel)] transition-colors`}
    >
      {seller.avatarUrl ? (
        <img
          src={seller.avatarUrl}
          alt={`${seller.displayName} seller profile`}
          className="w-[88px] h-[88px] object-cover border border-[var(--line)] shrink-0"
        />
      ) : (
        <div
          aria-hidden="true"
          className="w-[88px] h-[88px] grid place-items-center border border-[var(--line)] bg-[var(--bg)] font-heading text-2xl text-[var(--steel)] shrink-0"
        >
          {seller.displayName.slice(0, 1)}
        </div>
      )}

      <div className="min-w-0 flex flex-col justify-between h-full">
        <div>
          <p className="flex items-center gap-1 text-[var(--steel)] text-xs font-mono mb-1">
            <Star size={13} fill="currentColor" /> {seller.statistics.ratingAvg.toFixed(1)} ({seller.statistics.ratingCount})
          </p>
          <h3 className="font-heading font-semibold text-xl uppercase leading-tight text-[var(--ink)] my-1 flex items-center gap-1.5">
            <Link href={`/sellers/${seller.slug}`} className="hover:text-[var(--steel)] transition-colors">
              {seller.displayName}
            </Link>
            {seller.verified && (
              <span
                className="inline-grid w-4 h-4 place-items-center rounded-full bg-[var(--steel)] text-[var(--bg)] text-[11px] font-bold"
                aria-label={t('common.verifiedSeller')}
                title={t('common.verifiedSeller')}
              >
                ✓
              </span>
            )}
          </h3>
          <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed my-1">
            {seller.headline ?? t('seller.sellersLabel')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--dim)] mt-2">
          <span>
            <b className="text-[var(--ink)]">{seller.statistics.publishedScripts}</b> {t('seller.products')}
          </span>
          <span className="text-[var(--dim)]">·</span>
          <span>
            <b className="text-[var(--ink)]">{seller.statistics.views.toLocaleString('en-US')}</b> {t('seller.views')}
          </span>

          {!showContact && (
            <Link
              className="inline-flex items-center gap-1.5 text-[var(--steel)] font-heading font-semibold text-sm hover:underline ml-auto"
              href={`/sellers/${seller.slug}`}
            >
              {t('seller.viewProfile')} <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {showContact && (
        <div className="seller-card-actions">
          {/* Nút liên hệ ở trên */}
          <Link
            className="seller-btn-contact"
            href={`/contact?seller=${encodeURIComponent(seller.displayName)}`}
            aria-label={t('seller.contact')}
            title={t('seller.contact')}
          >
            <Send size={14} aria-hidden="true" className="shrink-0" />
            <span>{t('seller.contact')}</span>
          </Link>

          {/* Nút xem thêm ở dưới */}
          <Link
            className="seller-btn-profile"
            href={`/sellers/${seller.slug}`}
            aria-label={t('seller.viewProfile')}
            title={t('seller.viewProfile')}
          >
            <span>{t('seller.viewProfile')}</span>
            <ArrowRight size={14} aria-hidden="true" className="shrink-0" />
          </Link>
        </div>
      )}
    </article>
  );
}
