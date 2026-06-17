import React from "react";

export type SourceOption = {
  id: string;
  label: string;
  description: string;
};

export type SourceField = {
  label: string;
  placeholder: string;
  value?: string;
  onChange?: (v: string) => void;
};

export type SourceInputCardProps = {
  selectedSourceId?: string;
  options: SourceOption[];
  onSelect?: (id: string) => void;
  authLabel?: string;
  fields?: SourceField[];
};

export function SourceInputCard({
  selectedSourceId,
  options,
  onSelect,
  authLabel,
  fields = [],
}: SourceInputCardProps) {
  return (
    <section className="ck">
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Data source</div>
          <div className="ck-title">Choose your source</div>
        </div>
      </div>

      <div className="ck-body">
        <div className="ck-si-options">
          {options.map((opt) => {
            const active = opt.id === selectedSourceId;
            return (
              <div
                key={opt.id}
                className={`ck-si-option${active ? " ck-si-option--active" : ""}`}
                onClick={() => onSelect?.(opt.id)}
              >
                <div className="ck-si-label">{opt.label}</div>
                <div className="ck-si-desc">{opt.description}</div>
              </div>
            );
          })}
        </div>

        {authLabel && (
          <div className="ck-info">
            <strong>Auth required:</strong> {authLabel}
          </div>
        )}

        {fields.length > 0 && (
          <div className="ck-si-fields">
            {fields.map((f, i) => (
              <div key={i} className="ck-si-field">
                <label className="ck-si-field-label">{f.label}</label>
                <input
                  className="ck-si-field-input"
                  placeholder={f.placeholder}
                  value={f.value ?? ""}
                  onChange={(e) => f.onChange?.(e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default SourceInputCard;
