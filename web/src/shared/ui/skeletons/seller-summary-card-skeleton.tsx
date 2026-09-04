export function SellerSummaryCardSkeleton() {
  return (
    <article className="seller-summary-card" aria-hidden="true">
      <div className="skeleton" style={{ width: '88px', height: '88px' }} />
      <div className="seller-summary-card__content">
        <div className="skeleton" style={{ width: '60px', height: '11px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '70%', height: '18px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ width: '90%', height: '13px', marginBottom: '10px' }} />
        <div className="skeleton" style={{ width: '60%', height: '11px', marginBottom: '12px' }} />
        <div className="skeleton" style={{ width: '40%', height: '14px' }} />
      </div>
    </article>
  );
}
