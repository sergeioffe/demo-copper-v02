import React from "react";

export type ChangeLine = {
  id: string;
  op: "add" | "modify" | "remove" | "warning";
  label: string;
  detail?: string;
};

export type ChangeSummaryCardProps = {
  title: string;
  status?: "proposed" | "accepted" | "rejected" | "applied" | "rolled_back";
  why?: string;
  changes: ChangeLine[];
  consequences?: string[];
  warnings?: string[];
  affectedObjects?: string[];
  onAccept?: () => void;
  onReject?: () => void;
  onRollback?: () => void;
  onInspect?: () => void;
};

const OP_SYMBOL: Record<ChangeLine["op"], string> = {
  add: "+",
  modify: "~",
  remove: "−",
  warning: "!",
};

function statusBadge(status: string) {
  if (status === "accepted" || status === "applied") return "ck-badge--green";
  if (status === "rejected" || status === "rolled_back") return "ck-badge--coral";
  return "ck-badge--blue";
}

export function ChangeSummaryCard({
  title,
  status = "proposed",
  why,
  changes,
  consequences = [],
  warnings = [],
  affectedObjects = [],
  onAccept,
  onReject,
  onRollback,
  onInspect,
}: ChangeSummaryCardProps) {
  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Change summary</div>
          <div className="ck-title">{title}</div>
        </div>
        <div className="ck-head-right">
          <span className={`ck-badge ${statusBadge(status)}`}>{status}</span>
        </div>
      </div>

      <div className="ck-body">
        {why && (
          <div className="ck-info">
            <span style={{ fontWeight: 600, color: "var(--txt)" }}>Why: </span>{why}
          </div>
        )}

        <div className="ck-changes">
          {changes.map((c) => (
            <div key={c.id} className="ck-change">
              <div className={`ck-change-op ck-change-op--${c.op}`}>{OP_SYMBOL[c.op]}</div>
              <div className="ck-change-body">
                <div className="ck-change-label">{c.label}</div>
                {c.detail && <div className="ck-change-detail">{c.detail}</div>}
              </div>
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <div className="ck-list ck-list--warn">
            <div className="ck-list-title">Warnings</div>
            {warnings.map((w) => <div key={w} className="ck-list-item">{w}</div>)}
          </div>
        )}

        {consequences.length > 0 && (
          <div className="ck-list ck-list--default">
            <div className="ck-list-title">Consequences</div>
            {consequences.map((c) => <div key={c} className="ck-list-item">{c}</div>)}
          </div>
        )}

        {affectedObjects.length > 0 && (
          <div className="ck-list ck-list--default">
            <div className="ck-list-title">Affected</div>
            {affectedObjects.map((o) => <div key={o} className="ck-list-item">{o}</div>)}
          </div>
        )}

        {(onAccept || onReject || onRollback || onInspect) && (
          <div className="ck-actions">
            {onAccept   && <button className="ck-btn ck-btn--primary" onClick={onAccept}>Accept</button>}
            {onReject   && <button className="ck-btn" onClick={onReject}>Reject</button>}
            {onRollback && <button className="ck-btn" onClick={onRollback}>Rollback</button>}
            {onInspect  && <button className="ck-btn ck-btn--link" onClick={onInspect}>Inspect</button>}
          </div>
        )}
      </div>
    </section>
  );
}

export default ChangeSummaryCard;
