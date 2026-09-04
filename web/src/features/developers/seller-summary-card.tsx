'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import type { Developer } from './model';
import { useI18n } from '@/i18n';

export function SellerSummaryCard({ seller }: { seller: Developer }) {
  const { locale, t } = useI18n();

  return (
    <article className="seller-summary-card grid grid-cols-[88px_minmax(0,1fr)] gap-4 p-5 bg-[var(--panel)] border-r border-b border-[var(--line)] hover:border-[var(--steel)] transition-colors">
      <Image
        src={seller.avatar}
        alt={`${seller.name} seller profile`}
        width={88}
        height={88}
        className="w-[88px] h-[88px] object-cover border border-[var(--line)]"
      />
      <div className="seller-summary-card__content min-w-0 flex flex-col justify-between">
        <div>
          <p className="seller-summary-card__rating flex items-center gap-1 text-[var(--steel)] text-xs font-mono mb-1">
            <Star size={13} fill="currentColor" /> {seller.rating} (
            {seller.reviewCount})
          </p>
          <h3 className="font-heading font-semibold text-xl uppercase leading-tight text-[var(--ink)] my-1">
            <Link href={`/developers/${seller.slug}`} className="hover:text-[var(--steel)] transition-colors">
              {seller.name}
            </Link>
            {seller.verified && (
              <span className="seller-verified inline-grid w-4 h-4 ml-1.5 place-items-center rounded-full bg-[var(--steel)] text-[var(--bg)] font-bold text-[11px] align-middle">
                <span aria-hidden="true">✓</span>
                <span className="sr-only">{t('common.verifiedSeller')}</span>
              </span>
            )}
          </h3>
          <p className="text-xs text-[var(--muted)] line-clamp-2 leading-relaxed my-1">
            {locale === 'vi' ? seller.headlineVi : seller.headline}
          </p>
        </div>
        <div>
          <div className="seller-summary-card__stats flex flex-wrap gap-2 text-[10px] font-mono text-[var(--dim)] mt-2">
            <span>
              <b className="text-[var(--ink)] font-bold">{seller.products}</b> {t('seller.products')}
            </span>
            <span>
              <b className="text-[var(--ink)] font-bold">{seller.views.toLocaleString('en-US')}</b> {t('seller.views')}
            </span>
          </div>
          <Link
            className="seller-summary-card__link inline-flex items-center gap-1.5 mt-3 text-[var(--steel)] font-heading font-semibold text-sm hover:translate-x-1 transition-transform"
            href={`/developers/${seller.slug}`}
          >
            {t('seller.viewProfile')} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
