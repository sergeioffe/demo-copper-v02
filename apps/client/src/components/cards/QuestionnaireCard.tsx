import React, { useState } from "react";
import { useStore } from "../../store.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QuestionType =
  | "text"
  | "number"
  | "date"
  | "date-range"
  | "select"
  | "multi-select";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  placeholder?: string;
  options?: string[];
}

export interface QuestionnaireCardProps {
  title?: string;
  questions: Question[];
}

type DateRange = { from: string; to: string };
type AnswerValue = string | string[] | DateRange;

// ── Serialization ──────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return iso; }
}

function serializeAnswers(questions: Question[], answers: Record<string, AnswerValue>): string {
  const lines: string[] = [];
  for (const q of questions) {
    const val = answers[q.id];
    if (val == null) continue;
    if (q.type === "date-range") {
      const { from, to } = val as DateRange;
      if (!from && !to) continue;
      const parts = [from && fmtDate(from), to && fmtDate(to)].filter(Boolean);
      lines.push(`${q.label}: ${parts.join(" to ")}`);
    } else if (q.type === "multi-select") {
      const arr = val as string[];
      if (arr.length === 0) continue;
      lines.push(`${q.label}: ${arr.join(", ")}`);
    } else if (q.type === "date") {
      const s = (val as string).trim();
      if (s) lines.push(`${q.label}: ${fmtDate(s)}`);
    } else {
      const s = (val as string).trim();
      if (s) lines.push(`${q.label}: ${s}`);
    }
  }
  return lines.join("\n");
}

function hasAnyAnswer(questions: Question[], answers: Record<string, AnswerValue>): boolean {
  return questions.some((q) => {
    const val = answers[q.id];
    if (val == null) return false;
    if (q.type === "date-range") {
      const { from, to } = val as DateRange;
      return !!(from || to);
    }
    if (q.type === "multi-select") return (val as string[]).length > 0;
    return !!(val as string).trim();
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function QuestionnaireCard({ title, questions }: QuestionnaireCardProps) {
  const setPendingCardSubmit = useStore((s) => s.setPendingCardSubmit);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  function setAnswer(id: string, val: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  }

  function handleSubmit() {
    const serialized = serializeAnswers(questions, answers);
    if (!serialized) return;
    setSubmitted(true);
    setPendingCardSubmit(serialized);
  }

  return (
    <section className={`ck ck-q${submitted ? " ck-q--submitted" : ""}`}>
      <div className="ck-head">
        <div className="ck-head-left">
          <div className="ck-eyebrow">Questions</div>
          <div className="ck-title">{title ?? "A few things to help me plan"}</div>
        </div>
        {submitted && (
          <div className="ck-head-right">
            <div className="ck-badge ck-badge--teal">Sent</div>
          </div>
        )}
      </div>

      <div className="ck-body ck-q-body">
        {questions.map((q) => (
          <div key={q.id} className="ck-q-field">
            <label className="ck-q-label">{q.label}</label>
            <QuestionField
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
              disabled={submitted}
            />
          </div>
        ))}

        {!submitted && (
          <div className="ck-actions ck-q-actions">
            <button
              className="ck-btn ck-btn--primary"
              onClick={handleSubmit}
              disabled={!hasAnyAnswer(questions, answers)}
            >
              Send answers
            </button>
            <span className="ck-q-hint">or add context below and send</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Per-field renderer ─────────────────────────────────────────────────────────

interface FieldProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  disabled: boolean;
}

function QuestionField({ question: q, value, onChange, disabled }: FieldProps) {
  switch (q.type) {
    case "text":
    case "number":
      return (
        <input
          className="ck-q-input"
          type={q.type}
          placeholder={q.placeholder ?? ""}
          value={(value as string) ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "date":
      return (
        <input
          className="ck-q-input ck-q-input--date"
          type="date"
          value={(value as string) ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "date-range": {
      const dr = (value as DateRange) ?? { from: "", to: "" };
      return (
        <div className="ck-q-date-range">
          <div className="ck-q-date-pair">
            <span className="ck-q-date-lbl">From</span>
            <input
              className="ck-q-input ck-q-input--date"
              type="date"
              value={dr.from}
              disabled={disabled}
              onChange={(e) => onChange({ ...dr, from: e.target.value })}
            />
          </div>
          <div className="ck-q-date-pair">
            <span className="ck-q-date-lbl">To</span>
            <input
              className="ck-q-input ck-q-input--date"
              type="date"
              value={dr.to}
              disabled={disabled}
              onChange={(e) => onChange({ ...dr, to: e.target.value })}
            />
          </div>
        </div>
      );
    }

    case "select":
      return (
        <select
          className="ck-q-select"
          value={(value as string) ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {(q.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "multi-select": {
      const selected = (value as string[]) ?? [];
      return (
        <div className="ck-q-multiselect">
          {(q.options ?? []).map((opt) => {
            const on = selected.includes(opt);
            return (
              <label key={opt} className={`ck-q-ms-opt${on ? " ck-q-ms-opt--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt]
                      : selected.filter((s) => s !== opt);
                    onChange(next);
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}

export default QuestionnaireCard;
