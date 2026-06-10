import React, { useRef, useLayoutEffect, useState, useEffect } from "react";
import { useStore } from "../store.js";
import { computeLayout } from "../layout/autoLayout.js";
import { IconAffiliate } from "@tabler/icons-react";
import TableNode from "./nodes/TableNode.js";
import { FilterEntityNode, AlgoAIEntityNode } from "./nodes/FilterNode.js";
import ImportNode from "./nodes/ImportNode.js";
import OutputNode from "./nodes/OutputNode.js";
import EdgeLayer from "./edges/EdgeLayer.js";
import type { DataPlanEntity } from "@copper/contracts";

export default function GraphCanvas() {
  const dataModel    = useStore((s) => s.dataModel());
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode   = useStore((s) => s.selectNode);

  const [sizes, setSizes] = useState<Record<string, number>>({});
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [altHeld, setAltHeld] = useState(false);
  const dragActive = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") { e.preventDefault(); setAltHeld(true); } };
    const up   = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(false); };
    const blur = () => setAltHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  function handlePanStart(e: React.MouseEvent) {
    if (!e.altKey) return;
    e.preventDefault();
    const el = scrollRef.current!;
    const startX = e.clientX, startY = e.clientY;
    const startLeft = el.scrollLeft, startTop = el.scrollTop;
    dragActive.current = true;
    el.style.cursor = "grabbing";
    function onMove(ev: MouseEvent) {
      el.scrollLeft = startLeft - (ev.clientX - startX);
      el.scrollTop  = startTop  - (ev.clientY - startY);
    }
    function onUp() {
      dragActive.current = false;
      el.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const { nodes: positions, graphWidth, graphHeight, div1X, div2X } = computeLayout(dataModel);

  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    for (const [id, el] of Object.entries(nodeRefs.current)) {
      if (el) next[id] = el.offsetHeight;
    }
    setSizes(next);
  }, [dataModel]);

  function makeRef(id: string) {
    return (el: HTMLDivElement | null) => { nodeRefs.current[id] = el; };
  }

  function clickNode(id: string) {
    if (dragActive.current || altHeld) return;
    selectNode(selectedNodeId === id ? null : id);
  }

  if (!dataModel) {
    return (
      <div className="canvas-empty">
        <IconAffiliate size={32} stroke={1} />
        <div className="canvas-empty-msg">No data plan model yet.</div>
        <div className="canvas-empty-sub">Describe your data in the context panel.</div>
      </div>
    );
  }

  const entities = dataModel.entities;

  return (
    <div
      ref={scrollRef}
      className="graph-scroll"
      style={{ cursor: altHeld ? "grab" : "default" }}
      onMouseDown={handlePanStart}
    >
      <div className="graph-canvas" style={{ width: graphWidth, minHeight: graphHeight, position: "relative" }}>
        {/* Region bands */}
        <div className="region-band input-band"  style={{ left: 0,     width: div1X            }} />
        <div className="region-band flow-band"   style={{ left: div1X, width: div2X - div1X    }} />
        <div className="region-band output-band" style={{ left: div2X, right: 0                }} />
        <div className="region-label rl-input"  style={{ left: 14          }}>Input · Impression &amp; Rule</div>
        <div className="region-label rl-flow"   style={{ left: div1X + 14  }}>Tables &amp; Activation Flow</div>
        <div className="region-label rl-output" style={{ left: div2X + 14  }}>Output · Outbound UA</div>
        <div className="region-divider" style={{ left: div1X }} />
        <div className="region-divider" style={{ left: div2X }} />

        {/* Render each entity */}
        {Object.entries(entities).map(([id, entity]) => {
          const pos = positions[id];
          if (!pos) return null;
          const isSelected = selectedNodeId === id;
          const commonProps = {
            id,
            nodeRef: makeRef(id),
            selected: isSelected,
            onClick: () => clickNode(id),
          };

          return (
            <div key={id} style={{ position: "absolute", left: pos.x, top: pos.y }}>
              {renderEntity(entity, commonProps)}
            </div>
          );
        })}

        <EdgeLayer
          model={dataModel}
          positions={positions}
          sizes={sizes}
          graphWidth={graphWidth}
          graphHeight={graphHeight}
        />
      </div>
    </div>
  );
}

function renderEntity(
  entity: DataPlanEntity,
  props: {
    id: string;
    nodeRef: (el: HTMLDivElement | null) => void;
    selected: boolean;
    onClick: () => void;
  },
) {
  switch (entity.type) {
    case "Table":   return <TableNode  entity={entity} {...props} />;
    case "Import":  return <ImportNode entity={entity} {...props} />;
    case "Filter":  return <FilterEntityNode entity={entity} {...props} />;
    case "AlgoAI":  return <AlgoAIEntityNode entity={entity} {...props} />;
    case "Output":  return <OutputNode entity={entity} {...props} />;
    default:
      // Graceful fallback for unknown types
      return (
        <div ref={props.nodeRef} className={`node node-unknown${props.selected ? " selected" : ""}`} onClick={props.onClick}>
          <div className="flow-name">{(entity as { name?: string }).name ?? props.id}</div>
          <div className="flow-kind">{(entity as { type: string }).type}</div>
        </div>
      );
  }
}
