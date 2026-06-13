import React from "react";

export type ValidationFinding = {
  id: string;
  title: string;
  column?: string;
  rowsAffected: number;
  severity?: "info" | "warning" | "error";
  status?: "open" | "ignored" | "excluded";
};

export type ValidationFindingsCardProps = {
  findings: ValidationFinding[];
  onExclude?: (id: string) => void;
  onIgnore?: (id: string) => void;
  onUndo?: (id: string) => void;
  onApplyAll?: (action: "exclude" | "ignore") => void;
};

const fmt = (n: number) => new Intl.NumberFormat().format(n);

export function ValidationFindingsCard({
  findings,
  onExclude,
  onIgnore,
  onUndo,
  onApplyAll,
}: ValidationFindingsCardProps) {
  const open = findings.filter((f) => !f.status || f.status === "open");

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Validation findings</div>
          <div className="ck-title">Issues list</div>
        </div>
        <div className="ck-head-right">
          <span className={`ck-badge ${findings.length ? "ck-badge--amber" : "ck-badge--green"}`}>
            {findings.length} {findings.length === 1 ? "issue" : "issues"}
          </span>
        </div>
      </div>

      <div className="ck-body">
        {onApplyAll && open.length > 0 && (
          <div className="ck-info">
            Apply to all open issues:&nbsp;
            <button className="ck-btn ck-btn--link" style={{ display: "inline" }} onClick={() => onApplyAll("exclude")}>Exclude</button>
            &nbsp;·&nbsp;
            <button className="ck-btn ck-btn--link" style={{ display: "inline" }} onClick={() => onApplyAll("ignore")}>Ignore</button>
          </div>
        )}

        <div className="ck-findings">
          {findings.map((f) => (
            <div key={f.id} className="ck-finding">
              <div className="ck-finding-body">
                <div className="ck-finding-title">{f.title}</div>
                <div className="ck-finding-meta">
                  {f.column ? `${f.column} · ` : ""}{fmt(f.rowsAffected)} rows affected
                </div>
              </div>
              <div className="ck-finding-actions">
                {f.status && f.status !== "open" ? (
                  <>
                    <span className={`ck-finding-status ck-finding-status--${f.status}`}>{f.status}</span>
                    {onUndo && <button className="ck-btn ck-btn--link" onClick={() => onUndo(f.id)}>Undo</button>}
                  </>
                ) : (
                  <>
                    {onExclude && <button className="ck-btn ck-btn--link" onClick={() => onExclude(f.id)}>Exclude</button>}
                    {onIgnore && <button className="ck-btn ck-btn--link" onClick={() => onIgnore(f.id)}>Ignore</button>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ValidationFindingsCard;
