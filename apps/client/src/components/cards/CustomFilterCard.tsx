import React, { useState } from "react";

export type CustomFilterCardProps = {
  columns: string[];
  operators?: string[];
  selectedColumn?: string;
  selectedOperator?: string;
  value?: string;
  onApply?: (column: string, operator: string, value: string) => void;
  onCancel?: () => void;
};

const DEFAULT_OPERATORS = ["=", "≠", ">", "<", "≥", "≤", "contains", "starts with", "is empty", "is not empty"];

export function CustomFilterCard({
  columns,
  operators = DEFAULT_OPERATORS,
  selectedColumn: initCol = "",
  selectedOperator: initOp = "=",
  value: initVal = "",
  onApply,
  onCancel,
}: CustomFilterCardProps) {
  const [column,   setColumn]   = useState(initCol   || columns[0] || "");
  const [operator, setOperator] = useState(initOp);
  const [value,    setValue]    = useState(initVal);

  const noValueOp = operator === "is empty" || operator === "is not empty";

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Custom filter</div>
          <div className="ck-title">Build a filter rule</div>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-cf-row">
          <div className="ck-cf-group">
            <label className="ck-cf-label">Column</label>
            <select className="ck-cf-select" value={column} onChange={(e) => setColumn(e.target.value)}>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="ck-cf-group">
            <label className="ck-cf-label">Operator</label>
            <select className="ck-cf-select" value={operator} onChange={(e) => setOperator(e.target.value)}>
              {operators.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {!noValueOp && (
            <div className="ck-cf-group ck-cf-group--grow">
              <label className="ck-cf-label">Value</label>
              <input
                className="ck-cf-input"
                placeholder="Filter value…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          )}
        </div>

        {column && (
          <div className="ck-info" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
            Rule: <strong>{column} {operator}{!noValueOp && value ? ` "${value}"` : ""}</strong>
          </div>
        )}

        <div className="ck-actions">
          <button
            className="ck-btn ck-btn--primary"
            onClick={() => onApply?.(column, operator, value)}
            disabled={!column}
          >
            Apply filter
          </button>
          {onCancel && <button className="ck-btn" onClick={onCancel}>Cancel</button>}
        </div>
      </div>
    </section>
  );
}

export default CustomFilterCard;
