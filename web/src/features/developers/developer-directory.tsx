'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AdSlot } from '@/features/advertising/ad-slot';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Page, PublicMarketplaceSeller } from '@/types';
import { PublicSellerSummaryCard } from './public-seller-summary-card';

const ITEMS_PER_PAGE = 4;

export function DeveloperDirectory() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query = params.get('q')?.toLowerCase() ?? '';
  const [draft, setDraft] = useState(params.get('q') ?? '');

  const pageParam = Number(params.get('page'));
  const currentPage =
    Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const sellers = useFetch(
    () => api.get<Page<PublicMarketplaceSeller>>('/store/sellers?skip=0&limit=100&sort=popular'),
    'public-seller-directory',
  );

  const updateSearch = (newQuery: string) => {
    const next = new URLSearchParams(params.toString());
    if (newQuery) next.set('q', newQuery);
    else next.delete('q');
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  const setPage = (page: number) => {
    const next = new URLSearchParams(params.toString());
    if (page > 1) next.set('page', String(page));
    else next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateSearch(draft.trim());
  };

  const clearSearch = () => {
    setDraft('');
    router.replace(pathname);
  };

  const items = useMemo(
    () =>
      (sellers.data?.items ?? []).filter((seller) =>
        !query ||
        `${seller.displayName} ${seller.headline ?? ''}`
          .toLowerCase()
          .includes(query),
      ),
    [query, sellers.data],
  );

  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const visible = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return items.slice(start, start + ITEMS_PER_PAGE);
  }, [items, safePage]);

  return (
    <>
      <form
        className="catalog-search flex items-center gap-2 p-2 bg-[var(--panel)] border border-[var(--line)] mb-6 hover:border-[var(--steel)] focus-within:border-[var(--steel)] transition-colors"
        onSubmit={handleSearchSubmit}
      >
        <Search size={18} className="text-[var(--dim)] ml-2 shrink-0" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('seller.searchPlaceholder')}
          aria-label={t('seller.searchPlaceholder')}
          className="flex-1 bg-transparent border-0 outline-none text-[var(--ink)] text-sm px-2 placeholder:text-[var(--dim)]"
        />
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="text-xs font-mono text-[var(--dim)] hover:text-[var(--ink)] px-2"
          >
            <X size={16} />
          </button>
        )}
        <button
          className="primary px-4 py-2 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm hover:opacity-90 transition-opacity whitespace-nowrap"
          type="submit"
        >
          {t('catalog.search')}
        </button>
      </form>

      {query && (
        <div className="flex items-center gap-2 mb-4 text-xs font-mono text-[var(--muted)]">
          <span>{t('catalog.resultsFound', { count: items.length })}</span>
          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--panel)] border border-[var(--line)] text-xs text-[var(--ink)] hover:border-[var(--steel)]"
          >
            {t('catalog.searchChip', { value: query })} <X size={12} className="text-[var(--steel)]" />
          </button>
        </div>
      )}

      {sellers.loading ? (
        <div className="developer-cards flex flex-col gap-4 mb-8" aria-busy="true">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <div key={index} className="h-36 bg-[var(--panel)] border border-[var(--line)] animate-pulse" />
          ))}
        </div>
      ) : items.length ? (
        <>
          <div className="developer-cards flex flex-col gap-4 mb-8">
            {visible.map((seller) => (
              <PublicSellerSummaryCard key={seller.id} seller={seller} showContact />
            ))}
          </div>
          <AdSlot slotId="developers-after-directory" />
          {totalPages > 1 && (
            <nav
              className="pager flex items-center justify-center gap-2 my-8 font-mono text-sm"
              aria-label={t('catalog.pagination')}
            >
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                aria-label={t('catalog.prevPage')}
                className="px-3 py-1.5 border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[var(--steel)]"
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    type="button"
                    className={`px-3 py-1.5 border min-w-[36px] h-[36px] flex items-center justify-center font-mono text-xs transition-colors ${
                      page === safePage
                        ? 'active bg-[var(--steel)] !text-[var(--bg)] border-[var(--steel)] font-bold shadow-sm'
                        : 'bg-[var(--panel)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--steel)] hover:text-[var(--steel)]'
                    }`}
                    onClick={() => setPage(page)}
                    aria-current={page === safePage ? 'page' : undefined}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                aria-label={t('catalog.nextPage')}
                className="px-3 py-1.5 border border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:not-disabled:border-[var(--steel)]"
              >
                &gt;
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="catalog-empty p-8 md:p-12 bg-[var(--panel)] border border-[var(--line)] text-center my-6">
          <h2 className="font-heading font-bold text-2xl uppercase text-[var(--ink)] mb-2">
            {t('catalog.noMatchTitle')}
          </h2>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6 leading-relaxed">
            {sellers.error ?? t('catalog.noMatchDescription')}
          </p>
          <button
            className="secondary px-5 py-2.5 border border-[var(--line)] bg-transparent font-heading font-semibold text-sm text-[var(--ink)] hover:border-[var(--steel)] hover:text-[var(--steel)] transition-colors"
            onClick={clearSearch}
          >
            {t('catalog.clearFilters')}
          </button>
        </div>
      )}
    </>
  );
}
