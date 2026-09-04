'use client'

import {
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Check,
  Filter,
  RotateCcw,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AdSlot } from '@/features/advertising/ad-slot'
import { useI18n } from '@/i18n'
import { api } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'
import { ScriptListItemSkeleton } from '@/shared/ui/skeletons/script-list-item-skeleton'
import type { Page, PublicScriptSummary, PublicTag } from '@/types'
import { platformsForScript } from './platforms'
import { ScriptListItem } from './script-list-item'

const limit = 8

const POPULAR_PLATFORMS = [
  'Browser',
  'Facebook',
  'TikTok',
  'Shopee',
  'Lazada',
  'YouTube',
  'Google Drive',
] as const

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
  const [mobileOpen, setMobileOpen] = useState(false)

  const page = Math.max(1, Number(params.get('page')) || 1)
  const sort = ['popular', 'newest', 'updated', 'views', 'price_asc', 'price_desc'].includes(params.get('sort') ?? '')
    ? params.get('sort')!
    : 'popular'

  const activeTagIds = params.get('tagIds')?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
  const activePlatform = params.get('platform') ?? ''

  const query = new URLSearchParams({
    skip: String((page - 1) * limit),
    limit: String(limit),
    sort,
  })
  if (params.get('q')) query.set('q', params.get('q')!)
  if (params.get('tagIds')) query.set('tagIds', params.get('tagIds')!)

  const result = useFetch(
    () => api.get<Page<PublicScriptSummary>>(`/store/scripts?${query}`),
    query.toString(),
  )

  const tagsResult = useFetch(
    () => api.get<PublicTag[]>('/store/tags'),
    'store-tags',
  )

  const availableTags: PublicTag[] =
    tagsResult.data && tagsResult.data.length > 0
      ? tagsResult.data
      : [
          { id: 'automation', name: 'Automation', slug: 'automation' },
          { id: 'data', name: 'Data', slug: 'data' },
          { id: 'operations', name: 'Operations', slug: 'operations' },
        ]

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

  const toggleTag = (tagId: string) => {
    const next = activeTagIds.includes(tagId)
      ? activeTagIds.filter((id) => id !== tagId)
      : [...activeTagIds, tagId]
    update({ tagIds: next.join(','), page: '1' })
  }

  const togglePlatform = (plat: string) => {
    if (activePlatform.toLowerCase() === plat.toLowerCase()) {
      update({ platform: '', page: '1' })
    } else {
      update({ platform: plat, page: '1' })
    }
  }

  const hasActiveFilters = Boolean(
    activeTagIds.length > 0 ||
      params.get('q') ||
      activePlatform ||
      (params.get('sort') && params.get('sort') !== 'popular'),
  )

  const clearAll = () => {
    setDraft('')
    router.replace(pathname)
  }

  const activeFilterCount =
    activeTagIds.length +
    (activePlatform ? 1 : 0) +
    (params.get('q') ? 1 : 0) +
    (params.get('sort') && params.get('sort') !== 'popular' ? 1 : 0)

  const rawItems = result.data?.items ?? []
  const displayItems = activePlatform
    ? rawItems.filter((item) => {
        const plats = platformsForScript(item.slug)
        return plats.some((p) => p.toLowerCase().includes(activePlatform.toLowerCase()))
      })
    : rawItems

  const total = activePlatform ? displayItems.length : (result.data?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="catalog-browser">
      <form
        className="catalog-search flex items-center gap-2 p-2 bg-[var(--panel)] border border-[var(--line)] mb-6"
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: draft.trim(), page: '1' })
        }}
      >
        <Search size={18} className="text-[var(--dim)] ml-2 shrink-0" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('catalog.searchPlaceholder')}
          className="flex-1 bg-transparent border-0 outline-none text-[var(--ink)] text-sm px-2 min-w-0"
        />
        {draft && (
          <button
            type="button"
            onClick={() => {
              setDraft('')
              update({ q: '', page: '1' })
            }}
            className="p-1 text-[var(--dim)] hover:text-[var(--ink)]"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
        <button
          className="primary px-4 py-2 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm shrink-0"
          type="submit"
        >
          {t('catalog.search')}
        </button>
      </form>

      {/* Mobile filter toggle bar */}
      <div className="filter-mobile-bar lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--panel)] border border-[var(--line)] text-xs font-mono uppercase text-[var(--ink)] hover:border-[var(--steel)] transition-colors"
        >
          <SlidersHorizontal size={14} />
          <span>{t('catalog.filters')}</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[var(--steel)] text-[var(--bg)] text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-mono text-[var(--dim)] hover:text-[var(--steel)] underline inline-flex items-center gap-1"
          >
            <RotateCcw size={12} />
            {t('catalog.clearAll')}
          </button>
        )}
      </div>

      <div className="catalog-layout">
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className="catalog-sidebar-overlay lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar Filter Column */}
        <aside className={`catalog-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="catalog-sidebar-header">
            <h2 className="catalog-sidebar-title">
              <Filter size={14} className="text-[var(--steel)]" />
              <span>{t('catalog.filters')}</span>
            </h2>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="filter-clear-all"
                  title={t('catalog.clearAll')}
                >
                  {t('catalog.clearAll')}
                </button>
              )}
              {mobileOpen && (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="lg:hidden p-1 text-[var(--dim)] hover:text-[var(--ink)]"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Filter Group: Categories / Tags */}
          <div className="filter-group">
            <h3 className="filter-group-title">
              <span>{t('catalog.categories')}</span>
              {activeTagIds.length > 0 && (
                <span className="text-[10px] font-mono text-[var(--steel)] font-semibold">
                  ({activeTagIds.length})
                </span>
              )}
            </h3>
            <div className="filter-options">
              <button
                type="button"
                onClick={() => update({ tagIds: '', page: '1' })}
                className={`filter-option-btn ${activeTagIds.length === 0 ? 'active' : ''}`}
              >
                <div className="flex items-center">
                  <span className="filter-option-checkbox">
                    {activeTagIds.length === 0 && <Check size={10} />}
                  </span>
                  <span>{t('catalog.all')}</span>
                </div>
              </button>

              {availableTags.map((tag) => {
                const isActive = activeTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`filter-option-btn ${isActive ? 'active' : ''}`}
                  >
                    <div className="flex items-center">
                      <span className="filter-option-checkbox">
                        {isActive && <Check size={10} />}
                      </span>
                      <span>{tag.name}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Filter Group: Sort Order */}
          <div className="filter-group">
            <h3 className="filter-group-title">{t('catalog.sort')}</h3>
            <div className="filter-options">
              {[
                { id: 'popular', label: t('catalog.topViews') },
                { id: 'newest', label: t('catalog.newest') },
                { id: 'updated', label: t('catalog.recentlyUpdated') },
                { id: 'views', label: t('catalog.mostWatched') },
                { id: 'price_asc', label: t('catalog.priceAsc') },
                { id: 'price_desc', label: t('catalog.priceDesc') },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => update({ sort: s.id, page: '1' })}
                  className={`filter-option-btn ${sort === s.id ? 'active' : ''}`}
                >
                  <div className="flex items-center">
                    <span className="filter-option-checkbox">
                      {sort === s.id && <Check size={10} />}
                    </span>
                    <span>{s.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Filter Group: Platforms */}
          <div className="filter-group">
            <h3 className="filter-group-title">{t('catalog.socialPlatforms')}</h3>
            <div className="filter-pills">
              {POPULAR_PLATFORMS.map((plat) => {
                const isActive = activePlatform.toLowerCase() === plat.toLowerCase()
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => togglePlatform(plat)}
                    className={`filter-pill ${isActive ? 'active' : ''}`}
                  >
                    {isActive && <Check size={10} />}
                    <span>{plat}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="mt-6 w-full py-2.5 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-xs uppercase text-center"
            >
              {t('catalog.showResults')} ({total})
            </button>
          )}
        </aside>

        {/* Main Content Column */}
        <div className="catalog-main">
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
                onChange={(e) => update({ sort: e.target.value, page: '1' })}
                className="bg-[var(--panel)] text-[var(--ink)] border border-[var(--line)] text-xs font-mono px-2 py-1 outline-none"
              >
                <option value="popular">{t('catalog.topViews')}</option>
                <option value="newest">{t('catalog.newest')}</option>
                <option value="views">{t('catalog.mostWatched')}</option>
                <option value="updated">{t('catalog.recentlyUpdated')}</option>
                <option value="price_asc">{t('catalog.priceAsc')}</option>
                <option value="price_desc">{t('catalog.priceDesc')}</option>
              </select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="filter-chips mb-4">
              {params.get('q') && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                    update({ q: '', page: '1' })
                  }}
                  className="font-mono text-xs"
                >
                  <span>{t('catalog.searchChip', { value: params.get('q')! })}</span>
                  <X size={12} />
                </button>
              )}
              {activeTagIds.map((tagId) => {
                const tagObj = availableTags.find((t) => t.id === tagId)
                return (
                  <button
                    key={tagId}
                    type="button"
                    onClick={() => toggleTag(tagId)}
                    className="font-mono text-xs"
                  >
                    <span>{tagObj?.name ?? tagId}</span>
                    <X size={12} />
                  </button>
                )
              })}
              {activePlatform && (
                <button
                  type="button"
                  onClick={() => togglePlatform(activePlatform)}
                  className="font-mono text-xs"
                >
                  <span>{activePlatform}</span>
                  <X size={12} />
                </button>
              )}
              {params.get('sort') && params.get('sort') !== 'popular' && (
                <button
                  type="button"
                  onClick={() => update({ sort: 'popular', page: '1' })}
                  className="font-mono text-xs"
                >
                  <span>
                    {sort === 'price_asc'
                      ? t('catalog.priceAsc')
                      : sort === 'price_desc'
                      ? t('catalog.priceDesc')
                      : sort === 'newest'
                      ? t('catalog.newest')
                      : sort === 'views'
                      ? t('catalog.mostWatched')
                      : t('catalog.recentlyUpdated')}
                  </span>
                  <X size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="font-mono text-xs text-[var(--steel)]"
              >
                <RotateCcw size={11} /> {t('catalog.clearAll')}
              </button>
            </div>
          )}

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
          ) : displayItems.length ? (
            <>
              <div className="catalog-list grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
                {displayItems.map((script) => (
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
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--line)] text-sm font-heading uppercase text-[var(--ink)] hover:border-[var(--steel)]"
                >
                  {t('catalog.clearFilters')}
                </button>
              )}
            </div>
          )}

          <AdSlot slotId="catalog-after-results" />
        </div>
      </div>
    </div>
  )
}
