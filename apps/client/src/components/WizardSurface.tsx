import React, { useEffect, useState } from "react";
import { useStore } from "../store.js";
import { CARD_REGISTRY } from "./cards/registry.js";
import type { WizardStep, WizardShape } from "../wizardStandin.js";
import type { ValidationFinding } from "./cards/ValidationFindingsCard.js";
import { chat } from "../api.js";
import type { Exchange } from "@copper/contracts";

type Draft = Record<string, Record<string, unknown>>;

function mergedProps(step: WizardStep, draft: Draft): Record<string, unknown> {
  return { ...(step.card?.props ?? {}), ...(draft[step.id] ?? {}) };
}

function buildCallbacks(
  step: WizardStep,
  draft: Draft,
  setDraft: React.Dispatch<React.SetStateAction<Draft>>,
): Record<string, unknown> {
  function patch(update: Record<string, unknown>) {
    setDraft((prev) => ({
      ...prev,
      [step.id]: { ...(prev[step.id] ?? {}), ...update },
    }));
  }

  switch (step.card?.cardType) {
    case "validationFindings": {
      const findings = (mergedProps(step, draft).findings ?? []) as ValidationFinding[];
      const setStatus = (id: string, status: "open" | "ignored" | "excluded") =>
        patch({ findings: findings.map((f) => (f.id === id ? { ...f, status } : f)) });
      return {
        onExclude:  (id: string) => setStatus(id, "excluded"),
        onIgnore:   (id: string) => setStatus(id, "ignored"),
        onUndo:     (id: string) => setStatus(id, "open"),
        onApplyAll: (action: "exclude" | "ignore") =>
          patch({
            findings: findings.map((f) =>
              !f.status || f.status === "open"
                ? { ...f, status: action === "exclude" ? "excluded" : "ignored" }
                : f,
            ),
          }),
      };
    }
    case "filterRecommendation":
      return {
        onApply:   () => patch({ status: "applied" }),
        onDismiss: () => patch({ status: "dismissed" }),
        onUndo:    () => patch({ status: "recommended" }),
      };
    case "keySelection":
      return {
        onApply:  () => patch({ _applied: true }),
        onCancel: () => patch({ _applied: false }),
        onEdit:   () => {},
      };
    case "sourceInput":
      return { onSelect: (id: string) => patch({ selectedSourceId: id }) };
    case "fieldMapping": {
      const rows = (mergedProps(step, draft).rows ?? []) as Array<Record<string, unknown>>;
      return {
        onChangeMapping: (idx: number, systemColumn: string) =>
          patch({ rows: rows.map((r, i) => (i === idx ? { ...r, systemColumn } : r)) }),
      };
    }
    case "importSettings":
      return { onEdit: () => {}, onSave: () => {} };
    case "tablePreview":
      return { onSave: () => {} };
    case "customFilter":
      return {
        onApply:  (col: string, op: string, val: string) => patch({ selectedColumn: col, selectedOperator: op, value: val, _applied: true }),
        onCancel: () => patch({ _applied: false }),
      };
    default:
      return {};
  }
}

// Synthesize a natural-language message from what the user configured in the wizard
function buildCommitMessage(shape: WizardShape, draft: Draft): string {
  const { steps } = shape.wizard;

  const discoveryStep = steps.find((s) => s.card?.cardType === "tableDiscovery");
  const keyStep       = steps.find((s) => s.card?.cardType === "keySelection");

  if (!discoveryStep) return `Add: ${shape.wizard.title}`;

  const props     = mergedProps(discoveryStep, draft);
  const tableName = (props.tableName as string | undefined) ?? "Unknown";
  const rows      = props.rows as number | undefined;
  const columns   = props.columns as number | undefined;

  let msg = `Add a table called "${tableName}"`;
  if (rows)    msg += ` with ${rows.toLocaleString()} rows`;
  if (columns) msg += ` and ${columns} column${columns === 1 ? "" : "s"}`;

  if (keyStep) {
    const kp      = mergedProps(keyStep, draft);
    const keyName = kp.keyName as string | undefined;
    if (keyName) msg += `. Use "${keyName}" as the primary key`;
  }

  return msg + ".";
}

function WizardPanel({
  shape,
  onClose,
  onCommit,
}: {
  shape: WizardShape;
  onClose: () => void;
  onCommit: (shape: WizardShape, draft: Draft) => Promise<void>;
}) {
  const { title, steps, commit } = shape.wizard;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [draft, setDraft]           = useState<Draft>({});
  const [committed, setCommitted]   = useState(false);

  useEffect(() => {
    if (!committed) return;
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [committed, onClose]);

  const step      = steps[currentIdx];
  const isFirst   = currentIdx === 0;
  const isLast    = currentIdx === steps.length - 1;
  const props     = step.card ? mergedProps(step, draft) : {};
  const callbacks = step.card ? buildCallbacks(step, draft, setDraft) : {};
  const Component = step.card ? CARD_REGISTRY[step.card.cardType] : undefined;

  async function handleCommit() {
    setCommitted(true);
    await onCommit(shape, draft);
  }

  return (
    <div className="wizard-modal-backdrop" onClick={onClose}>
      <div className="wizard-modal-panel" onClick={(e) => e.stopPropagation()}>
        <button className="wizard-modal-close" onClick={onClose} title="Close">✕</button>

        {committed ? (
          <div className="wizard-done">
            <div className="wizard-done-icon">✓</div>
            <div className="wizard-done-title">{title} — saved</div>
            <div className="wizard-done-sub">Closing…</div>
          </div>
        ) : (
          <div className="wizard-shell">
            {/* Step rail */}
            <div className="wizard-rail">
              <div className="wizard-rail-title">{title}</div>
              <div className="wizard-rail-steps">
                {steps.map((s, i) => {
                  const done   = i < currentIdx;
                  const active = i === currentIdx;
                  const stub   = s.stub === true;
                  return (
                    <div
                      key={s.id}
                      className={[
                        "wizard-step",
                        active ? "wizard-step--active" : "",
                        done   ? "wizard-step--done"   : "",
                        stub   ? "wizard-step--stub"   : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => !stub && setCurrentIdx(i)}
                      style={{ cursor: stub ? "default" : "pointer" }}
                    >
                      <div className="wizard-step-num">{done ? "✓" : i + 1}</div>
                      <div className="wizard-step-label">{s.label}</div>
                      {stub && <span className="wizard-step-coming">coming</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage */}
            <div className="wizard-stage">
              <div className="wizard-card-area">
                {step.stub ? (
                  <div className="wizard-stub-placeholder">
                    <div className="wizard-stub-icon">◎</div>
                    <div className="wizard-stub-label">{step.label}</div>
                    <div className="wizard-stub-sub">This step is coming soon.</div>
                  </div>
                ) : Component ? (
                  <Component {...props} {...callbacks} />
                ) : (
                  <div className="wizard-stub-placeholder">
                    <div className="wizard-stub-label">Unknown card: {step.card?.cardType}</div>
                  </div>
                )}
              </div>

              <div className="wizard-controls">
                <button
                  className="wizard-btn wizard-btn--ghost"
                  onClick={() => setCurrentIdx((i) => i - 1)}
                  disabled={isFirst}
                >
                  ← Back
                </button>
                <span className="wizard-step-counter">{currentIdx + 1} / {steps.length}</span>
                {isLast ? (
                  <button className="wizard-btn wizard-btn--primary" onClick={() => void handleCommit()}>
                    {commit.label}
                  </button>
                ) : (
                  <button className="wizard-btn wizard-btn--primary" onClick={() => setCurrentIdx((i) => i + 1)}>
                    Continue →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WizardSurface() {
  const wizardShape        = useStore((s) => s.wizardShape);
  const closeWizard        = useStore((s) => s.closeWizard);
  const version            = useStore((s) => s.version);
  const llmModel           = useStore((s) => s.llmModel);
  const exchanges          = useStore((s) => s.version?.context.exchanges) ?? [];
  const appendExchanges    = useStore((s) => s.appendExchanges);
  const mergeServerVersion = useStore((s) => s.mergeServerVersion);
  const setLoading         = useStore((s) => s.setLoading);
  const openWizard         = useStore((s) => s.openWizard);
  const setPendingTable    = useStore((s) => s.setPendingTable);

  async function onCommit(shape: WizardShape, draft: Draft) {
    if (!version) return;
    const text = buildCommitMessage(shape, draft);

    // Plant a ghost node on the canvas immediately so the user sees something
    const discoveryStep = shape.wizard.steps.find((s) => s.card?.cardType === "tableDiscovery");
    if (discoveryStep) {
      const props = mergedProps(discoveryStep, draft);
      const name = (props.tableName as string | undefined) ?? "Table";
      setPendingTable({ name });
    }

    const ts   = new Date().toISOString();
    const userEx: Exchange = {
      id: `ex_u_${Date.now()}`,
      role: "user",
      text,
      status: "success",
      startedAt: ts,
    };
    appendExchanges([userEx]);
    setLoading(true);
    try {
      const result = await chat(version.id!, text, llmModel, [...exchanges, userEx], version, undefined, { isWizardCommit: true });
      appendExchanges([result.exchange]);
      if (result.version) mergeServerVersion(result.version); // also clears pendingTable
      if (result.wizard)  openWizard(result.wizard);
    } catch (err) {
      console.error("[wizard commit]", err);
    } finally {
      setPendingTable(null); // safety fallback if no version returned
      setLoading(false);
    }
  }

  if (!wizardShape) return null;
  return <WizardPanel shape={wizardShape} onClose={closeWizard} onCommit={onCommit} />;
}

export default WizardSurface;
