import React, { useState, useRef, useEffect, useCallback } from "react";
import type { MediaPlanModel, AnyEntity } from "@copper/contracts";
import { TYPE_META, COLS, getRelated, getRootRows, statusBadgeStyle, typeBadgeStyle } from "./schema.js";

const GG_NW   = 470;
const HDR_H   = 36;
const THEAD_H = 26;
const ROW_H   = 27;
const INDENT_X = 60;
const GAP_Y    = 16;
const MIN_Y    = 18;

type RowData = Record<string, unknown> & { id: string };

interface GGNodeDef {
  id: string;
  type: string;
  title: string;
  rows: RowData[];
  x: number;
  y: number;
  parentId: string | null;
  parentRowId: string | null;
  depth: number;
}

function rowAnchorY(node: GGNodeDef, rowIdx: number) {
  return node.y + HDR_H + THEAD_H + rowIdx * ROW_H + ROW_H / 2;
}

interface GGNodeProps {
  node: GGNodeDef;
  entities: Record<string, AnyEntity>;
  connections: Array<{ from: string; to: string }>;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
  onExpand: (nodeId: string, nodeType: string, row: RowData, childType: string, childIds: string[]) => void;
  onClose: (nodeId: string) => void;
}

function GGNode({ node, entities, connections, selection, onSelectionChange, onExpand, onClose }: GGNodeProps) {
  const tm = TYPE_META[node.type] ?? TYPE_META.MediaPartner;
  const cols = COLS[node.type] ?? [];
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div className="mg-gg-node" style={{ left: node.x, top: node.y, width: GG_NW }} data-nid={node.id}>
      <div className="mg-gg-nhdr" style={{ borderLeft: `3px solid ${tm.c}` }}>
        <span className="mg-type-tag" style={typeBadgeStyle(node.type)}>{tm.label}</span>
        <span className="mg-gg-ntitle" title={node.title}>{node.title}</span>
        <span className="mg-gg-count">{node.rows.length}</span>
        {node.parentId && (
          <button className="mg-gg-close" onClick={() => onClose(node.id)}>✕</button>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="mg-table">
          <thead>
            <tr>
              <th style={{ width: 22 }} />
              {cols.map((c) => <th key={c.k} style={{ minWidth: c.w }}>{c.l}</th>)}
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row) => {
              const isSel = selection.includes(row.id);
              const related = getRelated(row.id, entities as Record<string, { type: string }>, connections);
              const available = Object.keys(related).filter((t) => t !== node.type);
              return (
                <tr
                  key={row.id}
                  className={isSel ? "mg-row sel" : "mg-row"}
                  onClick={() =>
                    onSelectionChange(isSel ? selection.filter((i) => i !== row.id) : [...selection, row.id])
                  }
                >
                  <td style={{ padding: "4px 4px 4px 8px" }}>
                    <div className={`mg-ck${isSel ? " on" : ""}`} onClick={(e) => e.stopPropagation()} />
                  </td>
                  {cols.map((c) => (
                    <td key={c.k} className={c.k === "name" ? "mg-cell-name" : ""}>
                      {c.k === "status" ? (
                        <span className="mg-badge" style={statusBadgeStyle((row.status as string) ?? "planned")}>
                          {(row.status as string) ?? "planned"}
                        </span>
                      ) : (
                        <span>{(row[c.k] as string) ?? "—"}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ padding: "4px 5px", textAlign: "right" }}>
                    {available.length > 0 && (
                      <div style={{ position: "relative", display: "inline-block" }}>
                        <button
                          className="mg-xb"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenu(openMenu === row.id ? null : row.id);
                          }}
                        >
                          ▾
                        </button>
                        {openMenu === row.id && (
                          <div className="mg-xmenu">
                            {available.map((t) => {
                              const tm2 = TYPE_META[t] ?? TYPE_META.MediaPartner;
                              return (
                                <div
                                  key={t}
                                  className="mg-xopt"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenu(null);
                                    onExpand(node.id, node.type, row, t, related[t] ?? []);
                                  }}
                                >
                                  <span className="mg-xdot" style={{ background: tm2.c }} />
                                  {tm2.label} ({(related[t] ?? []).length})
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface Props {
  model: MediaPlanModel;
  organizeBy: string;
  selection: string[];
  onSelectionChange: (ids: string[]) => void;
}

export default function ViewGraphGrid({ model, organizeBy, selection, onSelectionChange }: Props) {
  const { entities, connections } = model;
  const [nodes, setNodes] = useState<GGNodeDef[]>([]);
  const [seq, setSeq] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rootRows = getRootRows(organizeBy, entities as Record<string, { type: string; name?: string }>) as RowData[];
    const tm = TYPE_META[organizeBy] ?? TYPE_META.MediaPartner;
    setNodes([{
      id: "root",
      type: organizeBy,
      title: `${tm.label} — all`,
      rows: rootRows,
      x: 18,
      y: 18,
      parentId: null,
      parentRowId: null,
      depth: 0,
    }]);
  }, [organizeBy, entities]);

  const handleExpand = useCallback(
    (nodeId: string, _nodeType: string, row: RowData, childType: string, childIds: string[]) => {
      setNodes((prev) => {
        const existing = prev.find((n) => n.parentRowId === row.id && n.type === childType);
        if (existing) {
          const toRemove = new Set<string>();
          const collect = (id: string) => {
            toRemove.add(id);
            prev.filter((n) => n.parentId === id).forEach((n) => collect(n.id));
          };
          collect(existing.id);
          return prev.filter((n) => !toRemove.has(n.id));
        }
        if (!childIds.length) return prev;

        const childRows = childIds.map((id) => ({ id, ...(entities[id] as object) })) as RowData[];
        const parNode = prev.find((n) => n.id === nodeId);
        if (!parNode) return prev;

        const tm2 = TYPE_META[childType] ?? TYPE_META.MediaPartner;
        const rowIdx = parNode.rows.findIndex((r) => r.id === row.id);
        const depth = (parNode.depth ?? 0) + 1;
        const x = parNode.x + GG_NW + INDENT_X;
        const rowApproxY = rowAnchorY(parNode, rowIdx) - HDR_H / 2;

        const sameCol = prev.filter((n) => Math.abs(n.x - x) < 30);
        let y = rowApproxY;
        if (sameCol.length) {
          const bottomOfCol = Math.max(...sameCol.map((n) => n.y + HDR_H + THEAD_H + n.rows.length * ROW_H + GAP_Y));
          y = Math.max(y, bottomOfCol);
        }
        y = Math.max(y, MIN_Y);

        const newSeq = seq + 1;
        setSeq(newSeq);
        const nid = `n${newSeq}`;
        return [...prev, { id: nid, type: childType, title: `${tm2.label}: ${String(row.name ?? row.id).substring(0, 26)}`, rows: childRows, x, y, parentId: nodeId, parentRowId: row.id, depth }];
      });
    },
    [entities, seq],
  );

  const handleClose = useCallback((nodeId: string) => {
    setNodes((prev) => {
      const toRemove = new Set<string>();
      const collect = (id: string) => {
        toRemove.add(id);
        prev.filter((n) => n.parentId === id).forEach((n) => collect(n.id));
      };
      collect(nodeId);
      return prev.filter((n) => !toRemove.has(n.id));
    });
  }, []);

  const canvasW = nodes.length ? Math.max(...nodes.map((n) => n.x + GG_NW)) + 60 : 800;
  const canvasH = nodes.length ? Math.max(...nodes.map((n) => n.y + HDR_H + THEAD_H + n.rows.length * ROW_H)) + 60 : 500;

  return (
    <div className="mg-v2" ref={containerRef}>
      {/* Canvas fills the panel; min-width/min-height ensure scroll when content grows */}
      <div className="mg-v2-canvas" style={{ minWidth: canvasW, minHeight: canvasH }}>
        <svg className="mg-v2-svg" style={{ width: canvasW, height: canvasH }}>
          <defs>
            <marker id="gg-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
              <path d="M2 2L8 5L2 8" fill="none" stroke="#c8c5ba" strokeWidth={1.5} strokeLinecap="round" />
            </marker>
          </defs>
          {nodes.map((n) => {
            if (!n.parentId) return null;
            const par = nodes.find((p) => p.id === n.parentId);
            if (!par) return null;
            const rowIdx = par.rows.findIndex((r) => r.id === n.parentRowId);
            const x1 = par.x + GG_NW;
            const y1 = rowAnchorY(par, rowIdx);
            const x2 = n.x;
            const y2 = n.y + HDR_H / 2;
            const mx = (x1 + x2) / 2;
            const tm2 = TYPE_META[n.type] ?? TYPE_META.MediaPartner;
            return (
              <g key={`edge-${n.id}`}>
                <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={tm2.c} strokeWidth={1.5} strokeOpacity={0.4} markerEnd="url(#gg-arrow)" />
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize={9} fill={tm2.c} fontFamily="var(--font)" fontWeight={600} letterSpacing=".5px" style={{ textTransform: "uppercase" }}>
                  {tm2.label}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mg-v2-nodes" style={{ width: canvasW, height: canvasH }}>
          {nodes.map((n) => (
            <GGNode
              key={n.id}
              node={n}
              entities={entities as Record<string, AnyEntity>}
              connections={connections}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onExpand={handleExpand}
              onClose={handleClose}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
