'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { developers } from '@/features/developers';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { DeveloperDetailContent } from '@/features/developers';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Page, PublicScriptSummary } from '@/types';

export default function DeveloperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const developer = developers.find((item) => item.slug === slug);
  if (!developer) notFound();

  const scriptsResult = useFetch(
    () => api.get<Page<PublicScriptSummary>>('/store/scripts?limit=50'),
    'developer-scripts',
  );

  const developerScripts = (scriptsResult.data?.items ?? []).filter(
    (script) =>
      script.seller.displayName.toLowerCase() === developer.name.toLowerCase(),
  );

  return (
    <>
      <StoreHeader />
      <DeveloperDetailContent
        developer={developer}
        developerScripts={developerScripts}
      />
      <StoreFooter />
    </>
  );
}

