import React from "react";

export type TablePreviewCardProps = {
  tableName: string;
  rowsCount: number;
  columns: string[];
  rows: string[][];
  pageSize?: number;
  onSave?: () => void;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export function TablePreviewCard({
  tableName,
  rowsCount,
  columns,
  rows,
  pageSize = 5,
  onSave,
}: TablePreviewCardProps) {
  const displayRows = rows.slice(0, pageSize);

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Preview</div>
          <div className="ck-title">{tableName}</div>
          <div className="ck-sub">{fmt(rowsCount)} rows · {columns.length} columns</div>
        </div>
        <div className="ck-head-right">
          <span className="ck-badge ck-badge--teal">Ready</span>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-tp-scroll">
          <table className="ck-tp-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} className="ck-tp-th">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, ri) => (
                <tr key={ri}>
                  {columns.map((_, ci) => (
                    <td key={ci} className="ck-tp-td">{row[ci] ?? ""}</td>
                  ))}
                </tr>
              ))}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="ck-tp-td" style={{ textAlign: "center", color: "var(--txt3)" }}>
                    No preview rows
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rowsCount > pageSize && (
          <div className="ck-info" style={{ marginTop: 6 }}>
            Showing {displayRows.length} of {fmt(rowsCount)} rows
          </div>
        )}

        {onSave && (
          <div className="ck-actions">
            <button className="ck-btn ck-btn--primary" onClick={onSave}>Looks good</button>
          </div>
        )}
      </div>
    </section>
  );
}

export default TablePreviewCard;
