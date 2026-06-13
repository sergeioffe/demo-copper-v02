import React from "react";

export type KeySelectionCardProps = {
  keyName: string;
  mode?: "single" | "composite";
  isRecommended?: boolean;
  isValid: boolean;
  uniqueValues: number;
  totalValues: number;
  duplicates: number;
  missing: number;
  sampleValues?: string[];
  reason?: string;
  onEdit?: () => void;
  onApply?: () => void;
  onCancel?: () => void;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export function KeySelectionCard({
  keyName,
  mode = "single",
  isRecommended,
  isValid,
  uniqueValues,
  totalValues,
  duplicates,
  missing,
  sampleValues = [],
  reason,
  onEdit,
  onApply,
  onCancel,
}: KeySelectionCardProps) {
  const pct = totalValues > 0 ? `${Math.round((uniqueValues / totalValues) * 100)}%` : undefined;

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Primary key{mode === "composite" ? " · composite" : ""}</div>
          <div className="ck-title">{keyName}</div>
          <div className={`ck-key-validity ck-key-validity--${isValid ? "ok" : "warn"}`}>
            {isValid ? "Fully unique and stable" : "Not valid — review duplicates"}
          </div>
        </div>
        <div className="ck-head-right">
          {isRecommended && <span className="ck-badge ck-badge--purple ck-badge--ai">AI Recommended</span>}
          {onEdit && <button className="ck-btn ck-btn--link" onClick={onEdit}>Edit</button>}
        </div>
      </div>

      <div className="ck-body">
        {reason && <div className="ck-info">{reason}</div>}

        <div className="ck-metrics">
          <Metric label="Unique / Total" value={`${fmt(uniqueValues)} / ${fmt(totalValues)}`} helper={pct} />
          <Metric label="Duplicates" value={fmt(duplicates)} warn={duplicates > 0} helper={duplicates > 0 ? "review" : "none"} />
          <Metric label="Missing" value={fmt(missing)} warn={missing > 0} helper={missing > 0 ? "review" : "none"} />
        </div>

        {sampleValues.length > 0 && (
          <div className="ck-info">
            <span style={{ fontWeight: 600, color: "var(--txt)" }}>Sample values: </span>
            <span className="ck-sample">{sampleValues.join(", ")}</span>
          </div>
        )}

        {(onApply || onCancel) && (
          <div className="ck-actions">
            {onApply && <button className="ck-btn ck-btn--primary" onClick={onApply}>Apply</button>}
            {onCancel && <button className="ck-btn" onClick={onCancel}>Cancel</button>}
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
      <div className={`ck-metric-val${warn ? " ck-metric-val--warn" : ""}`} style={{ fontSize: 14 }}>{value}</div>
      {helper && <div className="ck-metric-helper">{helper}</div>}
    </div>
  );
}

export default KeySelectionCard;
