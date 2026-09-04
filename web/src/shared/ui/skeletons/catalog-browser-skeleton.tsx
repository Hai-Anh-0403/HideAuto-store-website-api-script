import { ScriptListItemSkeleton } from './script-list-item-skeleton';

export function CatalogBrowserSkeleton() {
  return (
    <div className="catalog-browser catalog-browser--skeleton" aria-hidden="true">
      <div className="catalog-search flex items-center gap-2 p-2 bg-[var(--panel)] border border-[var(--line)] mb-6 h-[46px]">
        <div className="skeleton" style={{ flex: 1, height: '24px' }} />
        <div className="skeleton" style={{ width: '80px', height: '32px' }} />
      </div>
      <div className="catalog-layout flex gap-7 items-start mt-4">
        <aside className="catalog-sidebar w-[250px] shrink-0 bg-[var(--panel)] border border-[var(--line)] p-[18px] hidden lg:block">
          <div className="filter-title mb-4 pb-3 border-b border-[var(--line)]">
            <div className="skeleton" style={{ width: '80px', height: '16px' }} />
          </div>
          {[1, 2, 3].map((group) => (
            <fieldset key={group} className="mb-4">
              <div className="skeleton" style={{ width: '60%', height: '16px', marginBottom: '12px' }} />
              <div className="filter-options space-y-2">
                {[1, 2, 3].map((opt) => (
                  <div
                    key={opt}
                    className="skeleton"
                    style={{ width: `${60 + opt * 10}%`, height: '14px', marginBottom: '6px' }}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </aside>
        <section className="catalog-main flex-1 min-w-0">
          <div className="catalog-toolbar flex items-center justify-between pb-3 mb-6 border-b border-[var(--line)]">
            <div className="skeleton" style={{ width: '120px', height: '14px' }} />
            <div className="skeleton" style={{ width: '140px', height: '30px' }} />
          </div>
          <div className="catalog-list grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <ScriptListItemSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
