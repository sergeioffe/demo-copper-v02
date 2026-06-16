import React from "react";
import { useStore } from "../store.js";
import type { PanelFocus } from "../store.js";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { IconArrowsMaximize, IconArrowsMinimize, IconFileText } from "@tabler/icons-react";

export default function PlanDocument({ style }: { style?: React.CSSProperties }) {
  const activePlan          = useStore((s) => s.activePlan);
  const dataDocument        = useStore((s) => s.version?.plans.data.document ?? "");
  const mediaDocument       = useStore((s) => s.mediaDocument());
  const updateDataDocument  = useStore((s) => s.updateDataDocument);
  const updateMediaDocument = useStore((s) => s.updateMediaDocument);
  const panelFocus          = useStore((s) => s.panelFocus as PanelFocus);
  const setPanelFocus       = useStore((s) => s.setPanelFocus);

  const MaxBtn = () => (
    <button
      className={`panel-max-btn${panelFocus === "plan" ? " panel-max-btn--active" : ""}`}
      onClick={() => setPanelFocus(panelFocus === "plan" ? "none" : "plan")}
      title={panelFocus === "plan" ? "Restore" : "Expand"}
    >
      {panelFocus === "plan" ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={11} />}
    </button>
  );

  if (activePlan === "creative") {
    return (
      <div className="plan-doc plan-doc--stub" style={style}>
        <div className="plan-doc-empty">Creative Plan — coming soon</div>
      </div>
    );
  }

  if (activePlan === "data") {
    return (
      <div className="plan-doc" style={style}>
        <div className="plan-doc-header">
          <IconFileText size={13} style={{ color: "var(--teal-txt)", flexShrink: 0 }} />
          <span className="plan-doc-label">Data Plan · Document</span>
          <MaxBtn />
        </div>
        <div className="plan-doc-body plan-doc-cm">
          <CodeMirror
            value={dataDocument}
            onChange={updateDataDocument}
            extensions={[markdown()]}
            theme={oneDark}
            style={{ height: "100%", fontSize: 12 }}
          />
        </div>
      </div>
    );
  }

  // Media plan — editable markdown
  return (
    <div className="plan-doc" style={style}>
      <div className="plan-doc-header">
        <IconFileText size={13} style={{ color: "var(--teal-txt)", flexShrink: 0 }} />
        <span className="plan-doc-label">Media Plan · Document</span>
        <MaxBtn />
        <button
          className="btn btn-sm"
          disabled
          title="Implement Plan compiles document to model — requires M3"
        >
          Implement Plan
        </button>
      </div>
      <div className="plan-doc-body plan-doc-cm">
        <CodeMirror
          value={mediaDocument}
          onChange={updateMediaDocument}
          extensions={[markdown()]}
          theme={oneDark}
          style={{ height: "100%", fontSize: 12 }}
        />
      </div>
    </div>
  );
}
