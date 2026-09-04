'use client'

import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AdSlot } from '@/features/advertising/ad-slot'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'
import { ScriptListItemSkeleton } from '@/shared/ui/skeletons/script-list-item-skeleton'
import type { Page, PublicScriptSummary } from '@/types'
import { ScriptListItem } from './script-list-item'

const limit = 8

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages]
  }
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
}

export function CatalogBrowser() {
  const { t } = useI18n()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [draft, setDraft] = useState(params.get('q') ?? '')
  const page = Math.max(1, Number(params.get('page')) || 1)
  const sort = ['popular', 'newest', 'updated', 'views'].includes(params.get('sort') ?? '')
    ? params.get('sort')!
    : 'popular'

  const query = new URLSearchParams({
    skip: String((page - 1) * limit),
    limit: String(limit),
    sort,
  })
  if (params.get('q')) query.set('q', params.get('q')!)

  const result = useFetch(
    () => api.get<Page<PublicScriptSummary>>(`/store/scripts?${query}`),
    query.toString(),
  )

  const update = (next: Record<string, string>) => {
    const search = new URLSearchParams(params.toString())
    Object.entries(next).forEach(([key, value]) => {
      if (value) search.set(key, value)
      else search.delete(key)
    })
    if (!('page' in next)) {
      search.delete('page')
    }
    router.replace(`${pathname}?${search}`)
  }

  const total = result.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="catalog-browser">
      <form
        className="catalog-search flex items-center gap-2 p-2 bg-[var(--panel)] border border-[var(--line)] mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: draft.trim() })
        }}
      >
        <Search size={18} className="text-[var(--dim)] ml-2" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('catalog.searchPlaceholder')}
          className="flex-1 bg-transparent border-0 outline-none text-[var(--ink)] text-sm px-2"
        />
        <button
          className="primary px-4 py-2 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm"
          type="submit"
        >
          {t('catalog.search')}
        </button>
      </form>

      <div className="catalog-toolbar flex items-center justify-between gap-4 pb-3 mb-6 border-b border-[var(--line)]">
        <p className="font-mono text-xs text-[var(--muted)] m-0">
          {t('catalog.resultsFound', { count: total })}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="catalog-sort" className="font-mono text-xs text-[var(--dim)] uppercase">
            {t('catalog.sort')}:
          </label>
          <select
            id="catalog-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] text-xs font-mono px-2 py-1 outline-none"
          >
            <option value="popular">Popular</option>
            <option value="newest">{t('catalog.newest')}</option>
            <option value="views">{t('catalog.topViews')}</option>
            <option value="updated">{t('catalog.recentlyUpdated')}</option>
          </select>
        </div>
      </div>

      {result.loading ? (
        <div className="catalog-list grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {Array.from({ length: limit }).map((_, i) => (
            <ScriptListItemSkeleton key={i} />
          ))}
        </div>
      ) : result.error ? (
        <div className="catalog-error p-8 text-center bg-[var(--panel)] border border-[var(--line)] my-6">
          <p className="font-heading font-semibold text-lg uppercase text-[var(--ink)] mb-2">
            {t('common.actionFailed')}
          </p>
          <p className="text-sm text-[var(--muted)] mb-4">{result.error}</p>
          <button
            type="button"
            onClick={result.reload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm"
          >
            {t('common.refresh')}
          </button>
        </div>
      ) : result.data?.items.length ? (
        <>
          <div className="catalog-list grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {result.data.items.map((script) => (
              <ScriptListItem key={script.id} script={script} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="pager flex items-center justify-center gap-2 my-8 font-mono text-sm"
              aria-label={t('catalog.pagination')}
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
                aria-label={t('catalog.prevPage')}
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers(page, totalPages).map((item, idx) =>
                typeof item === 'string' ? (
                  <span key={`ellipsis-${idx}`} className="pager-ellipsis">
                    {item}
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    className={item === page ? 'active' : ''}
                    aria-current={item === page ? 'page' : undefined}
                    onClick={() => update({ page: String(item) })}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => update({ page: String(page + 1) })}
                aria-label={t('catalog.nextPage')}
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="catalog-empty p-8 text-center bg-[var(--panel)] border border-[var(--line)] my-6">
          <h2 className="font-heading font-bold text-xl uppercase text-[var(--ink)] mb-2">
            {t('catalog.noMatchTitle')}
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            {t('catalog.noMatchDescription')}
          </p>
          {(params.get('q') || params.get('sort')) && (
            <button
              type="button"
              onClick={() => {
                setDraft('')
                router.replace(pathname)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--line)] text-sm font-heading uppercase text-[var(--ink)] hover:border-[var(--steel)]"
            >
              {t('catalog.clearFilters')}
            </button>
          )}
        </div>
      )}

      <AdSlot slotId="catalog-after-results" />
    </div>
  )
}

