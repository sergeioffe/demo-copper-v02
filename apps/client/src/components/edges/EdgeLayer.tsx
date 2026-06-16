import React from "react";
import type { DataPlanModel } from "@copper/contracts";
import type { NodeLayout } from "../../layout/autoLayout.js";

const COLORS = {
  import:  "#f59e0b",
  flow:    "#a855f7",
  output:  "#22c55e",
  default: "#60a5fa",
};

function marker(id: string, color: string) {
  return (
    <marker key={id} id={id} markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill={color} />
    </marker>
  );
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function getPort(
  positions: Record<string, NodeLayout>,
  sizes: Record<string, number>,
  id: string,
  side: "left" | "right",
) {
  const pos = positions[id];
  if (!pos) return null;
  const w = pos.width ?? 160;
  const h = sizes[id] ?? 80;
  return {
    x: side === "right" ? pos.x + w : pos.x,
    y: pos.y + h / 2,
  };
}

function edgeColor(fromType: string, toType: string): { color: string; markerId: string } {
  if (fromType === "Import")  return { color: COLORS.import,  markerId: "arrow-amber"  };
  if (toType   === "Output")  return { color: COLORS.output,  markerId: "arrow-green"  };
  if (fromType === "Filter" || fromType === "AlgoAI") {
    return { color: COLORS.flow, markerId: "arrow-purple" };
  }
  return { color: COLORS.default, markerId: "arrow-blue" };
}

interface Props {
  model: DataPlanModel;
  positions: Record<string, NodeLayout>;
  sizes: Record<string, number>;
  graphWidth: number;
  graphHeight: number;
}

export default function EdgeLayer({ model, positions, sizes, graphWidth, graphHeight }: Props) {
  const edges: Array<{
    id: string;
    path: string;
    color: string;
    markerId: string;
  }> = [];

  for (const conn of model.connections) {
    const src = getPort(positions, sizes, conn.from, "right");
    const tgt = getPort(positions, sizes, conn.to,   "left");
    if (!src || !tgt) continue;

    const fromEntity = model.entities[conn.from];
    const toEntity   = model.entities[conn.to];
    const { color, markerId } = edgeColor(
      fromEntity?.type ?? "",
      toEntity?.type   ?? "",
    );

    edges.push({
      id: `${conn.from}→${conn.to}`,
      path: bezier(src.x, src.y, tgt.x, tgt.y),
      color,
      markerId,
    });
  }

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", overflow: "visible" }}
      width={graphWidth}
      height={graphHeight}
    >
      <defs>
        {marker("arrow-amber",  COLORS.import)}
        {marker("arrow-purple", COLORS.flow)}
        {marker("arrow-green",  COLORS.output)}
        {marker("arrow-blue",   COLORS.default)}
      </defs>
      {edges.map((e) => (
        <path
          key={e.id}
          d={e.path}
          stroke={e.color}
          strokeWidth={1.5}
          fill="none"
          markerEnd={`url(#${e.markerId})`}
        />
      ))}
    </svg>
  );
}
