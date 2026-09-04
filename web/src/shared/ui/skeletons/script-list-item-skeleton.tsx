export function ScriptListItemSkeleton() {
  return (
    <article className="script-list-item" aria-hidden="true">
      <div className="script-list-link">
        <div className="script-thumbnail skeleton" />
        <div className="script-list-copy">
          <div className="skeleton" style={{ width: '50px', height: '10px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '85%', height: '18px', marginBottom: '6px' }} />
          <div className="skeleton" style={{ width: '55%', height: '12px', marginBottom: '6px' }} />
          <div className="skeleton" style={{ width: '40%', height: '11px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ width: '35%', height: '16px' }} />
        </div>
      </div>
    </article>
  );
}
