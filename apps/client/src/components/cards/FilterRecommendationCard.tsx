import React from "react";

export type FilterRecommendationCardProps = {
  title: string;
  reason: string;
  rowsRemoved: number;
  field?: string;
  operator?: string;
  value?: string;
  status?: "recommended" | "applied" | "dismissed";
  onApply?: () => void;
  onDismiss?: () => void;
  onUndo?: () => void;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

function statusBadge(status: string) {
  if (status === "applied") return "ck-badge--green";
  if (status === "dismissed") return "ck-badge--coral";
  return "ck-badge--purple ck-badge--ai";
}

export function FilterRecommendationCard({
  title,
  reason,
  rowsRemoved,
  field,
  operator,
  value,
  status = "recommended",
  onApply,
  onDismiss,
  onUndo,
}: FilterRecommendationCardProps) {
  const rule = [field, operator, value].filter(Boolean).join(" ");

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Filter recommendation</div>
          <div className="ck-title">{title}</div>
        </div>
        <div className="ck-head-right">
          <span className={`ck-badge ${statusBadge(status)}`}>
            {status === "recommended" ? "AI Recommended" : status}
          </span>
          <div className="ck-filter-impact">
            <span className="ck-filter-count">−{fmt(rowsRemoved)}</span>
            <span className="ck-filter-unit">rows</span>
          </div>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-info">{reason}</div>

        {rule && (
          <div className="ck-info" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            Rule: <strong>{rule}</strong>
          </div>
        )}

        {(onApply || onDismiss || onUndo) && (
          <div className="ck-actions">
            {status === "applied" && onUndo ? (
              <button className="ck-btn" onClick={onUndo}>Undo</button>
            ) : (
              <>
                {onApply && <button className="ck-btn ck-btn--primary" onClick={onApply}>Apply</button>}
                {onDismiss && <button className="ck-btn" onClick={onDismiss}>Dismiss</button>}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default FilterRecommendationCard;
