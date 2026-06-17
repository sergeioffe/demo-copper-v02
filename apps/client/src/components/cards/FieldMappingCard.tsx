import React from "react";

export type FieldMappingRow = {
  fileColumn: string;
  systemColumn: string;
  type: string;
  required?: boolean;
};

export type FieldMappingCardProps = {
  rows: FieldMappingRow[];
  mappedCount: number;
  totalCount: number;
  typeWarnings?: number;
  onChangeMapping?: (idx: number, systemColumn: string) => void;
};

export function FieldMappingCard({
  rows,
  mappedCount,
  totalCount,
  typeWarnings = 0,
  onChangeMapping,
}: FieldMappingCardProps) {
  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Column mapping</div>
          <div className="ck-title">Field mapping</div>
          <div className="ck-sub">{mappedCount} of {totalCount} columns mapped</div>
        </div>
        <div className="ck-head-right">
          {typeWarnings > 0 && (
            <span className="ck-badge ck-badge--amber">{typeWarnings} type warning{typeWarnings !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-fm-table">
          <div className="ck-fm-head-row">
            <div className="ck-fm-hcell">Source column</div>
            <div className="ck-fm-hcell">System field</div>
            <div className="ck-fm-hcell">Type</div>
          </div>
          {rows.map((row, i) => (
            <div key={i} className="ck-fm-row">
              <div className="ck-fm-cell">
                <span className="ck-sample">{row.fileColumn}</span>
                {row.required && <span className="ck-badge ck-badge--coral" style={{ marginLeft: 4, fontSize: 9 }}>req</span>}
              </div>
              <div className="ck-fm-cell">
                {onChangeMapping ? (
                  <input
                    className="ck-fm-input"
                    value={row.systemColumn}
                    onChange={(e) => onChangeMapping(i, e.target.value)}
                  />
                ) : (
                  <span className="ck-sample">{row.systemColumn}</span>
                )}
              </div>
              <div className="ck-fm-cell ck-fm-type">{row.type}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FieldMappingCard;
