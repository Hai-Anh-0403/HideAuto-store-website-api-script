export function ScriptListItemSkeleton() {
  return (
    <article className="script-list-item" aria-hidden="true">
      <div className="script-list-link grid grid-cols-[100px_minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)] gap-3 sm:gap-4 p-3 bg-[var(--panel)] border border-[var(--line)] min-h-[146px]">
        <div className="script-thumbnail relative shrink-0 aspect-square overflow-hidden border border-[var(--line)] bg-[var(--bg)] skeleton" />
        <div className="script-list-copy min-w-0 flex flex-col justify-between">
          <div>
            <div className="skeleton" style={{ width: '50px', height: '10px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ width: '85%', height: '18px', marginBottom: '6px' }} />
            <div className="skeleton" style={{ width: '55%', height: '12px', marginBottom: '6px' }} />
            <div className="skeleton" style={{ width: '40%', height: '11px', marginBottom: '8px' }} />
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-[var(--line)]">
            <div className="skeleton" style={{ width: '40px', height: '10px' }} />
            <div className="skeleton" style={{ width: '35px', height: '16px' }} />
          </div>
        </div>
      </div>
    </article>
  );
}
