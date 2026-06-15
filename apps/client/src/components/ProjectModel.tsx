import React, { useState } from "react";
import { useStore } from "../store.js";
import GraphCanvas from "./GraphCanvas.js";
import MediaGraph from "./mediaGraph/MediaGraph.js";
import InspectorPanel from "./InspectorPanel.js";
import { classifyFile } from "../lib/parseContextFile.js";
import { useDocumentHandlers } from "../hooks/useDocumentHandlers.js";
import { IconCloudUpload } from "@tabler/icons-react";

export default function ProjectModel() {
  const activePlan = useStore((s) => s.activePlan);
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
      <div className="project-model project-model--empty">
        <div className="model-empty-msg">Creative Plan model — coming soon</div>
      </div>
    );
  }

  return (
    <div
      className={`project-model${dragOver ? " project-model--drag" : ""}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
