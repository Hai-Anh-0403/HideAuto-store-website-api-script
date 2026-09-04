'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, Star } from 'lucide-react';
import type { PublicScriptSummary } from '@/types';
import type { CatalogScript } from './data';

const viewFormatter = new Intl.NumberFormat('en-US');

export const ScriptListItem = memo(function ScriptListItem({
  script,
  priority = false,
}: {
  script: PublicScriptSummary | CatalogScript;
  priority?: boolean;
}) {
  const isPublic = 'statistics' in script
  const thumbnail = isPublic ? script.thumbnailUrl ?? '/images/icon.png' : script.image
  const seller = isPublic ? script.seller.displayName : script.seller
  const version = isPublic ? script.latestApprovedVersion : script.version
  const rating = isPublic ? script.statistics.ratingAvg.toFixed(1) : String(script.watches)
  const views = isPublic ? script.statistics.views : script.views
  const description = isPublic ? script.shortDescription : script.outcome
  const tags = isPublic ? script.tags.map((tag) => tag.name).join(' · ') : script.platform
  const price = ('price' in script && script.price) ? script.price : '$29'
  return (
    <article className="script-list-item group transition-all duration-200">
      <div className="script-list-link grid grid-cols-[100px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] gap-3 sm:gap-4 p-3 bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--steel)] transition-colors">
        <Link
          className="script-thumbnail relative shrink-0 aspect-square overflow-hidden border border-[var(--line)] bg-[var(--bg)]"
          href={`/scripts/${script.slug}`}
          aria-label={`View ${script.name}`}
        >
          <Image
            src={thumbnail}
            alt={`Preview for ${script.name}`}
            width={120}
            height={120}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            sizes="(max-width: 760px) 100px, 120px"
            className="w-full h-full object-cover filter saturate-75 contrast-105 group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
        <div className="script-list-copy min-w-0 flex flex-col justify-between">
          <div>
            <span className="status font-mono text-[9px] uppercase tracking-wider text-[var(--steel)] font-semibold block mb-0.5">
              VERSION {version}
            </span>
            <h3 className="font-heading font-bold text-base sm:text-lg leading-snug uppercase text-[var(--ink)] group-hover:text-[var(--steel)] transition-colors truncate">
              <Link href={`/scripts/${script.slug}`}>{script.name}</Link>
            </h3>
            <p className="script-seller text-xs text-[var(--muted)] flex items-center gap-1.5 my-0.5 truncate">
              <Link
                href="/sellers"
                className="hover:underline hover:text-[var(--steel)] font-medium"
              >
                {seller}
              </Link>{' '}
              <b className="text-[var(--steel)] text-[8px]" aria-label="Verified seller">●</b>
            </p>
            <p className="script-meta font-mono text-[10px] text-[var(--dim)] flex items-center gap-2 my-0.5">
              <span className="inline-flex items-center gap-1">
                <Star size={11} fill="currentColor" className="text-[var(--steel)]" /> {rating}
              </span>
              <span className="inline-flex items-center gap-1">
                <Eye size={11} /> {viewFormatter.format(views)}
              </span>
            </p>
            <p className="script-outcome text-xs text-[var(--muted)] line-clamp-2 my-1 leading-normal">
              {description}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-[var(--line)]">
            <small className="script-social-tags font-mono text-[10px] text-[var(--dim)] truncate">
              {tags}
            </small>
            <strong className="font-heading font-bold text-sm sm:text-base text-[var(--ink)] whitespace-nowrap">
              {price}
            </strong>
          </div>
        </div>
      </div>
    </article>
  );
});
