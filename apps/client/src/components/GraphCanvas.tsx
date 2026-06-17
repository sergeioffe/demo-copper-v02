import React, { useRef, useLayoutEffect, useState, useEffect } from "react";
import { useStore } from "../store.js";
import { computeLayout } from "../layout/autoLayout.js";
import { IconAffiliate } from "@tabler/icons-react";
import TableNode from "./nodes/TableNode.js";
import { FilterEntityNode, AlgoAIEntityNode } from "./nodes/FilterNode.js";
import ImportNode from "./nodes/ImportNode.js";
import OutputNode from "./nodes/OutputNode.js";
import EdgeLayer from "./edges/EdgeLayer.js";
import NodeContextMenu from "./NodeContextMenu.js";
import type { DataPlanEntity } from "@copper/contracts";

const DP_POSITIONS_KEY = "copper-dp-positions";
function loadDPPositions(): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(DP_POSITIONS_KEY) ?? "{}"); } catch { return {}; }
}
function saveDPPositions(pos: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(DP_POSITIONS_KEY, JSON.stringify(pos)); } catch {}
}

export default function GraphCanvas() {
  const dataModel    = useStore((s) => s.dataModel());
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode   = useStore((s) => s.selectNode);
  const pendingTable = useStore((s) => s.pendingTable);
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage);
  const renameDataEntity  = useStore((s) => s.renameDataEntity);
  const removeDataEntity  = useStore((s) => s.removeDataEntity);
  const duplicateDataEntity = useStore((s) => s.duplicateDataEntity);

  const [sizes, setSizes] = useState<Record<string, number>>({});
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const [altHeld, setAltHeld] = useState(false);
  const dragActive = useRef(false);
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>(() => loadDPPositions());
  const draggingNode = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const nodeDragged = useRef(false);
  const [activePrompt, setActivePrompt] = useState<{ id: string; entity: DataPlanEntity; x: number; y: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") { e.preventDefault(); setAltHeld(true); } };
    const up   = (e: KeyboardEvent) => { if (e.key === "Alt") setAltHeld(false); };
    const blur = () => setAltHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingNode.current) return;
      const { id, sx, sy, ox, oy } = draggingNode.current;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) nodeDragged.current = true;
      setPosOverrides((prev) => ({ ...prev, [id]: { x: ox + dx, y: oy + dy } }));
    };
    const onUp = () => {
      if (draggingNode.current) {
        draggingNode.current = null;
        setPosOverrides((prev) => { saveDPPositions(prev); return prev; });
      }
      requestAnimationFrame(() => { nodeDragged.current = false; });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
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

  // Merge layout positions with drag overrides (preserves width from layout)
  const effectivePositions = Object.fromEntries(
    Object.entries(positions).map(([id, pos]) => {
      const ov = posOverrides[id];
      return [id, ov ? { ...pos, x: ov.x, y: ov.y } : pos];
    })
  );

  // Compute canvas extents accounting for dragged node positions
  const entityIds = dataModel ? Object.keys(dataModel.entities) : [];
  const dynW = entityIds.reduce((mx, id) => {
    const base = positions[id];
    if (!base) return mx;
    return Math.max(mx, (posOverrides[id] ?? base).x + 320);
  }, graphWidth);
  const dynH = entityIds.reduce((mx, id) => {
    const base = positions[id];
    if (!base) return mx;
    return Math.max(mx, (posOverrides[id] ?? base).y + 160);
  }, graphHeight);

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

  function handleNodeMouseDown(e: React.MouseEvent, id: string, ox: number, oy: number) {
    e.stopPropagation();
    nodeDragged.current = false;
    draggingNode.current = { id, sx: e.clientX, sy: e.clientY, ox, oy };
  }

  function clickNode(id: string) {
    if (dragActive.current || altHeld || nodeDragged.current) return;
    if (selectedNodeId === id) {
      // Second click on same node — toggle off
      selectNode(null);
      setActivePrompt(null);
      return;
    }
    selectNode(id);
    const entities = dataModel?.entities;
    const entity = entities?.[id];
    if (entity) {
      const ep = posOverrides[id] ?? positions[id];
      if (ep) {
        setActivePrompt({ id, entity, x: ep.x, y: ep.y + (sizes[id] ?? 60) + 8 });
      }
    } else {
      setActivePrompt(null);
    }
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
      <div className="graph-canvas" style={{ width: dynW, minHeight: dynH, position: "relative" }}>
        {/* Region bands */}
        <div className="region-band input-band"  style={{ left: 0,     width: div1X            }} />
        <div className="region-band flow-band"   style={{ left: div1X, width: div2X - div1X    }} />
        <div className="region-band output-band" style={{ left: div2X, right: 0                }} />
        <div className="region-label rl-input"  style={{ left: 14          }}>INPUT</div>
        <div className="region-label rl-flow"   style={{ left: div1X + 14  }}>TABLES AND DATA FLOW</div>
        <div className="region-label rl-output" style={{ left: div2X + 14  }}>OUTPUT</div>
        <div className="region-divider" style={{ left: div1X }} />
        <div className="region-divider" style={{ left: div2X }} />

        {/* Render each entity */}
        {Object.entries(entities).map(([id, entity]) => {
          const pos = positions[id];
          if (!pos) return null;
          const ep = posOverrides[id] ?? pos;
          const isSelected = selectedNodeId === id;
          const commonProps = {
            id,
            nodeRef: makeRef(id),
            selected: isSelected,
            onClick: () => clickNode(id),
          };

          return (
            <div
              key={id}
              style={{ position: "absolute", left: ep.x, top: ep.y, cursor: "grab" }}
              onMouseDown={(e) => handleNodeMouseDown(e, id, ep.x, ep.y)}
            >
              {renderEntity(entity, commonProps)}
            </div>
          );
        })}

        <EdgeLayer
          model={dataModel}
          positions={effectivePositions}
          sizes={sizes}
          graphWidth={dynW}
          graphHeight={dynH}
        />

        {pendingTable && (
          <PendingTableNode
            name={pendingTable.name}
            x={div1X + 20}
            y={(() => {
              // Place below the last Table node in the flow region, or at top
              const tableNodeYs = Object.entries(positions)
                .filter(([id]) => dataModel?.entities[id]?.type === "Table")
                .map(([id]) => (posOverrides[id] ?? positions[id]).y + (sizes[id] ?? 80));
              return tableNodeYs.length > 0 ? Math.max(...tableNodeYs) + 12 : 30;
            })()}
          />
        )}

        {activePrompt && (
          <NodeContextMenu
            nodeId={activePrompt.id}
            entity={activePrompt.entity}
            x={activePrompt.x}
            y={activePrompt.y}
            onSend={(msg) => { setPendingChatMessage(msg); }}
            onRename={(name) => renameDataEntity(activePrompt.id, name)}
            onDelete={() => removeDataEntity(activePrompt.id)}
            onDuplicate={() => duplicateDataEntity(activePrompt.id)}
            onDismiss={() => { setActivePrompt(null); selectNode(null); }}
          />
        )}
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

function PendingTableNode({ name, x, y }: { name: string; x: number; y: number }) {
  return (
    <div className="node node-pending-table" style={{ position: "absolute", left: x, top: y }}>
      <div className="node-pending-header">
        <span className="node-pending-type">TABLE</span>
        <span className="node-pending-name">{name}</span>
      </div>
      <div className="node-pending-body">
        <span className="node-pending-spinner" />
        <span className="node-pending-label">Adding to model…</span>
      </div>
    </div>
  );
}
