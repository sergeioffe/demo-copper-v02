import React, { useState } from "react";
import { CARD_REGISTRY } from "./cards/registry.js";
import { getWizardShape } from "../wizardStandin.js";
import type { WizardStep } from "../wizardStandin.js";
import type { ValidationFinding } from "./cards/ValidationFindingsCard.js";

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
    default:
      return {};
  }
}

export function WizardSurface() {
  const shape = getWizardShape();
  const { title, steps, commit } = shape.wizard;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [committed, setCommitted] = useState(false);

  const step    = steps[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast  = currentIdx === steps.length - 1;

  if (committed) {
    return (
      <div className="wizard-done">
        <div className="wizard-done-icon">✓</div>
        <div className="wizard-done-title">{title} — saved</div>
        <div className="wizard-done-sub">Draft committed. The catalog is being prepared.</div>
      </div>
    );
  }

  const props     = step.card ? mergedProps(step, draft) : {};
  const callbacks = step.card ? buildCallbacks(step, draft, setDraft) : {};
  const Component = step.card ? CARD_REGISTRY[step.card.cardType] : undefined;

  return (
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
            <button className="wizard-btn wizard-btn--primary" onClick={() => setCommitted(true)}>
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
  );
}

export default WizardSurface;
