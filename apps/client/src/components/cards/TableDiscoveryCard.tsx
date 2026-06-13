import React from "react";

export type TableDiscoveryCardProps = {
  tableName: string;
  sourceLabel?: string;
  sourceUrl?: string;
  rows: number;
  columns: number;
  warnings?: number;
  skippedRows?: number;
  isLiveFeed?: boolean;
  status?: "analyzing" | "analyzed" | "error";
  onOpenSource?: () => void;
  onReload?: () => void;
  onDelete?: () => void;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

function statusBadge(status: string) {
  if (status === "analyzing") return "ck-badge--amber";
  if (status === "error") return "ck-badge--coral";
  return "ck-badge--blue";
}

export function TableDiscoveryCard({
  tableName,
  sourceLabel,
  sourceUrl,
  rows,
  columns,
  warnings = 0,
  skippedRows,
  isLiveFeed,
  status = "analyzed",
  onOpenSource,
  onReload,
  onDelete,
}: TableDiscoveryCardProps) {
  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Table discovered</div>
          <div className="ck-title">{tableName}</div>
          {sourceLabel && <div className="ck-sub">{sourceLabel}</div>}
        </div>
        <div className="ck-head-right">
          <span className={`ck-badge ${statusBadge(status)}`}>{status}</span>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-metrics">
          <Metric label="Rows" value={fmt(rows)} helper={skippedRows ? `${fmt(skippedRows)} skipped` : undefined} />
          <Metric label="Columns" value={fmt(columns)} helper="detected" />
          <Metric label="Warnings" value={fmt(warnings)} helper={warnings ? "non-blocking" : "none"} warn={warnings > 0} />
        </div>

        {isLiveFeed && (
          <div className="ck-info">
            Live feed — re-syncs on schedule; row count may change.
          </div>
        )}

        {sourceUrl && <div className="ck-url">{sourceUrl}</div>}

        {(onOpenSource || onReload || onDelete) && (
          <div className="ck-actions">
            {onOpenSource && <button className="ck-btn ck-btn--link" onClick={onOpenSource}>Open source</button>}
            {onReload && <button className="ck-btn" onClick={onReload}>Reload</button>}
            {onDelete && <button className="ck-btn ck-btn--danger" onClick={onDelete}>Delete</button>}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, helper, warn }: { label: string; value: string; helper?: string; warn?: boolean }) {
  return (
    <div className="ck-metric">
      <div className="ck-metric-label">{label}</div>
      <div className={`ck-metric-val${warn ? " ck-metric-val--warn" : ""}`}>{value}</div>
      {helper && <div className="ck-metric-helper">{helper}</div>}
    </div>
  );
}

export default TableDiscoveryCard;
