import React from "react";

export type FilterImpactSummaryCardProps = {
  originalRows: number;
  currentRows: number;
  activeFilters: number;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export function FilterImpactSummaryCard({
  originalRows,
  currentRows,
  activeFilters,
}: FilterImpactSummaryCardProps) {
  const removed  = Math.max(0, originalRows - currentRows);
  const pctKept  = originalRows > 0 ? Math.round((currentRows / originalRows) * 100) : 100;

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Live impact</div>
          <div className="ck-title">Filter summary</div>
        </div>
        <div className="ck-head-right">
          <span className="ck-badge ck-badge--blue">{activeFilters} filter{activeFilters !== 1 ? "s" : ""} active</span>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-fis-bar-wrap">
          <div className="ck-fis-bar" style={{ width: `${pctKept}%` }} />
        </div>
        <div className="ck-fis-bar-label">
          <span>{pctKept}% of rows kept</span>
          <span>{fmt(currentRows)} / {fmt(originalRows)}</span>
        </div>

        <div className="ck-metrics">
          <Metric label="Filters active" value={String(activeFilters)} />
          <Metric label="Rows kept"      value={fmt(currentRows)}   helper={`${pctKept}%`} />
          <Metric label="Rows removed"   value={fmt(removed)}       warn={removed > 0} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, helper, warn }: { label: string; value: string; helper?: string; warn?: boolean }) {
  return (
    <div className="ck-metric">
      <div className="ck-metric-label">{label}</div>
      <div className={`ck-metric-val${warn ? " ck-metric-val--warn" : ""}`} style={{ fontSize: 14 }}>{value}</div>
      {helper && <div className="ck-metric-helper">{helper}</div>}
    </div>
  );
}

export default FilterImpactSummaryCard;
