import { CatalogBrowserSkeleton } from '@/shared/ui/skeletons/catalog-browser-skeleton';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';

export default function Loading() {
  return (
    <>
      <StoreHeader />
      <main className="shell section catalog-page">
        <div className="skeleton" style={{ width: '160px', height: '12px', marginBottom: '16px' }} />
        <div className="heading">
          <div>
            <div className="skeleton" style={{ width: '320px', height: '36px', marginBottom: '14px' }} />
            <div className="skeleton" style={{ width: '480px', height: '16px' }} />
          </div>
        </div>
        <CatalogBrowserSkeleton />
      </main>
      <StoreFooter />
    </>
  );
}
