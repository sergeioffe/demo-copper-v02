import React from "react";

export type RefreshMode = "manual" | "scheduled" | "live";

export type ImportSettingsCardProps = {
  tableName: string;
  brand?: string;
  refreshMode: RefreshMode;
  scheduleLabel?: string;
  sourceLabel?: string;
  onEdit?: () => void;
  onSave?: () => void;
};

const MODE_LABELS: Record<RefreshMode, string> = {
  manual:    "Manual refresh",
  scheduled: "Scheduled",
  live:      "Live feed",
};

const MODE_DESCS: Record<RefreshMode, string> = {
  manual:    "You control when data updates",
  scheduled: "Auto-refresh on a schedule",
  live:      "Real-time connection",
};

export function ImportSettingsCard({
  tableName,
  brand,
  refreshMode,
  scheduleLabel,
  sourceLabel,
  onEdit,
  onSave,
}: ImportSettingsCardProps) {
  const modes: RefreshMode[] = ["manual", "scheduled", "live"];

  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Import settings</div>
          <div className="ck-title">{tableName}</div>
          {(brand || sourceLabel) && (
            <div className="ck-sub">{[brand, sourceLabel].filter(Boolean).join(" · ")}</div>
          )}
        </div>
        <div className="ck-head-right">
          {onEdit && <button className="ck-btn ck-btn--link" onClick={onEdit}>Edit</button>}
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-is-modes">
          {modes.map((m) => (
            <div key={m} className={`ck-is-mode${refreshMode === m ? " ck-is-mode--active" : ""}`}>
              <div className="ck-is-mode-label">{MODE_LABELS[m]}</div>
              <div className="ck-is-mode-desc">{MODE_DESCS[m]}</div>
            </div>
          ))}
        </div>

        {refreshMode === "scheduled" && scheduleLabel && (
          <div className="ck-info">
            <strong>Schedule:</strong> {scheduleLabel}
          </div>
        )}

        {onSave && (
          <div className="ck-actions">
            <button className="ck-btn ck-btn--primary" onClick={onSave}>Confirm settings</button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ImportSettingsCard;
