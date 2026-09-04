'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Mail, Phone, Send, Star } from 'lucide-react';
import type { Developer } from './model';
import { useI18n } from '@/i18n';

export function DeveloperCard({ developer }: { developer: Developer }) {
  const { locale, t } = useI18n();
  const isVi = locale === 'vi';

  return (
    <article className="grid grid-cols-1 sm:grid-cols-[100px_minmax(0,1fr)_auto] gap-4 sm:gap-6 p-4 sm:p-5 bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--steel)] transition-colors items-start">
      <Image
        src={developer.avatar}
        alt={`${developer.name} seller profile`}
        width={100}
        height={100}
        className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] object-cover border border-[var(--line)] shrink-0"
      />
      <div className="min-w-0">
        <h2 className="font-heading font-bold text-xl sm:text-2xl uppercase text-[var(--ink)] my-0 flex items-center flex-wrap gap-1">
          <Link href={`/developers/${developer.slug}`} className="hover:text-[var(--steel)] transition-colors">
            {developer.name}
          </Link>
          {developer.verified && (
            <span className="developer-verified inline-grid w-4 h-4 ml-1 place-items-center rounded-full bg-[var(--steel)] text-[var(--bg)] font-bold text-[11px] align-middle">
              <span aria-hidden="true">✓</span>
              <span className="sr-only">{t('common.verifiedSeller')}</span>
            </span>
          )}
        </h2>
        <p className="developer-stats flex flex-wrap items-center gap-1.5 font-mono text-xs text-[var(--steel)] my-1.5">
          <span className="inline-flex items-center gap-1">
            <Star size={14} fill="currentColor" /> {developer.rating} (
            {developer.reviewCount})
          </span>
          <span className="text-[var(--dim)]">·</span>
          <span>{t('seller.products')}: <b className="text-[var(--ink)]">{developer.products}</b></span>
          <span className="text-[var(--dim)]">·</span>
          <span>{t('seller.views')}: <b className="text-[var(--ink)]">{developer.views.toLocaleString('en-US')}</b></span>
          <span className="text-[var(--dim)]">·</span>
          <span>{t('seller.orders')}: <b className="text-[var(--ink)]">{developer.orders}</b></span>
        </p>
        <p className="text-xs sm:text-sm text-[var(--muted)] my-1.5 leading-relaxed">
          {isVi ? developer.headlineVi : developer.headline}
        </p>
        <p className="my-1">
          <small className="font-mono text-[10px] text-[var(--dim)]">
            {t('common.joined', { date: developer.joined })}
          </small>
        </p>
        <p className="developer-contact flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--muted)] mt-2">
          <span className="inline-flex items-center gap-1">
            <Mail size={14} className="text-[var(--steel)]" /> {developer.email}
          </span>
          <span className="inline-flex items-center gap-1">
            <Phone size={14} className="text-[var(--steel)]" /> {developer.phone}
          </span>
        </p>
      </div>
      <a
        className="primary developer-contact-button inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap self-start sm:self-center mt-2 sm:mt-0"
        href={`mailto:${developer.email}`}
      >
        <Send size={15} /> {t('seller.contact')}
      </a>
    </article>
  );
}
