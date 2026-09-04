'use client'

import { use } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useFetch } from '@/lib/useFetch'
import { useI18n } from '@/i18n'
import { StoreHeader } from '@/shared/ui/store-header'
import { StoreFooter } from '@/shared/ui/store-footer'
import { ScriptDetailContent } from '@/features/catalog'
import type { Page, PublicScriptDetail, PublicScriptSummary } from '@/types'

export default function ScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)
  const { t } = useI18n()

  const scriptResult = useFetch(
    () => api.get<PublicScriptDetail>(`/store/scripts/${encodeURIComponent(slug)}`),
    `script-detail-${slug}`,
  )

  const relatedResult = useFetch(
    () => api.get<Page<PublicScriptSummary>>('/store/scripts?limit=6&sort=popular'),
    'script-related',
  )

  const script = scriptResult.data
  const relatedScripts = (relatedResult.data?.items ?? [])
    .filter((item) => item.slug !== slug)
    .slice(0, 3)

  return (
    <>
      <StoreHeader />
      {scriptResult.loading ? (
        <main className="shell section py-16 text-center" aria-busy="true">
          <p className="font-mono text-xs text-[var(--dim)] uppercase tracking-wider animate-pulse">
            {t('system.loadingCatalog')}
          </p>
        </main>
      ) : scriptResult.error || !script ? (
        <main className="shell section py-16 text-center">
          <p className="label font-mono text-xs uppercase tracking-widest text-[var(--dim)] mb-2">
            {t('system.notFoundLabel')}
          </p>
          <h1 className="font-heading font-bold text-3xl uppercase text-[var(--ink)] mb-3">
            {t('system.notFoundTitle')}
          </h1>
          <p className="lead text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
            {t('system.notFoundLead')}
          </p>
          <Link
            href="/scripts"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--steel)] text-[var(--bg)] font-heading font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            {t('common.browseScripts')}
          </Link>
        </main>
      ) : (
        <ScriptDetailContent
          script={script}
          relatedScripts={relatedScripts}
        />
      )}
      <StoreFooter />
    </>
  )
}

