import { ScriptListItemSkeleton } from './script-list-item-skeleton';

export function CatalogBrowserSkeleton() {
  return (
    <div className="catalog-browser catalog-browser--skeleton" aria-hidden="true">
      <div className="catalog-search">
        <div className="skeleton" style={{ flex: 1, height: '24px' }} />
        <div className="skeleton" style={{ width: '80px', height: '32px' }} />
      </div>
      <div className="catalog-layout">
        <aside className="catalog-filters">
          <div className="filter-title">
            <div className="skeleton" style={{ width: '80px', height: '16px' }} />
          </div>
          {[1, 2, 3, 4].map((group) => (
            <fieldset key={group}>
              <div className="skeleton" style={{ width: '60%', height: '16px', marginBottom: '12px' }} />
              <div className="filter-options">
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
        <section className="catalog-results">
          <div className="catalog-toolbar">
            <div className="skeleton" style={{ width: '120px', height: '14px' }} />
            <div className="skeleton" style={{ width: '140px', height: '30px' }} />
          </div>
          <div className="catalog-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <ScriptListItemSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
