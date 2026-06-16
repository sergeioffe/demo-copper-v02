import React, { useState } from "react";
import { useStore } from "../store.js";
import type { PanelFocus } from "../store.js";
import GraphCanvas from "./GraphCanvas.js";
import MediaGraph from "./mediaGraph/MediaGraph.js";
import InspectorPanel from "./InspectorPanel.js";
import { classifyFile } from "../lib/parseContextFile.js";
import { useDocumentHandlers } from "../hooks/useDocumentHandlers.js";
import { IconCloudUpload, IconArrowsMaximize, IconArrowsMinimize, IconAffiliate } from "@tabler/icons-react";

export default function ProjectModel({ style }: { style?: React.CSSProperties }) {
  const activePlan    = useStore((s) => s.activePlan);
  const panelFocus    = useStore((s) => s.panelFocus as PanelFocus);
  const setPanelFocus = useStore((s) => s.setPanelFocus);
  const { launchWizard } = useDocumentHandlers();
  const [dragOver, setDragOver] = useState(false);

  // Route A — model surface: tabular files → launchWizard; others silently ignored
  async function handleFiles(files: File[]) {
    for (const f of files) {
      const cls = classifyFile(f.name);
      if (cls === "file") continue;
      await launchWizard(f);
      break; // one wizard at a time
    }
  }

  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    await handleFiles(Array.from(e.dataTransfer.files));
  }

  if (activePlan === "creative") {
    return (
      <div className="project-model project-model--empty" style={style}>
        <div className="model-empty-msg">Creative Plan model — coming soon</div>
      </div>
    );
  }

  return (
    <div
      className={`project-model${dragOver ? " project-model--drag" : ""}`}
      style={style}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="model-head">
        <IconAffiliate size={13} style={{ color: "var(--amber-txt)", flexShrink: 0 }} />
        <button
          className={`panel-max-btn${panelFocus === "model" ? " panel-max-btn--active" : ""}`}
          onClick={() => setPanelFocus(panelFocus === "model" ? "none" : "model")}
          title={panelFocus === "model" ? "Restore" : "Expand"}
        >
          {panelFocus === "model" ? <IconArrowsMinimize size={13} /> : <IconArrowsMaximize size={11} />}
        </button>
      </div>
      {dragOver && (
        <div className="drop-overlay">
          <IconCloudUpload size={28} />
          <span className="drop-overlay-label">Drop Table File</span>
          <span className="drop-overlay-sub">CSV · JSON · Excel</span>
        </div>
      )}
      {activePlan === "data" && (
        <div className="model-stage">
          <GraphCanvas />
          <InspectorPanel planType="data" />
        </div>
      )}
      {activePlan === "media" && (
        <div className="model-stage">
          <MediaGraph />
          <InspectorPanel planType="media" />
        </div>
      )}
    </div>
  );
}
