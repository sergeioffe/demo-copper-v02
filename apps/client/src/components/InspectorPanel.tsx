import React from "react";
import { useStore } from "../store.js";
import { TableDiscoveryCard } from "./cards/TableDiscoveryCard.js";
import { KeySelectionCard } from "./cards/KeySelectionCard.js";
import { FilterRecommendationCard } from "./cards/FilterRecommendationCard.js";
import { IconX, IconTable, IconFilter, IconCloudDownload, IconCpu, IconArrowBarToRight, IconBroadcast, IconLayout } from "@tabler/icons-react";
import type {
  DataPlanEntity,
  MediaPlanEntity,
  TableEntity,
  ImportEntity,
  FilterEntity,
  AlgoAIEntity,
  OutputEntity,
  ImpressionEntity,
  AnyEntity,
} from "@copper/contracts";

// ── Section primitives ────────────────────────────────────────────────────────

function Sec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="isec">
      <div className="isec-label">{label}</div>
      {children}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v?: React.ReactNode; mono?: boolean }) {
  if (v === undefined || v === null || v === "") return null;
  return (
    <div className="irow">
      <span className="ik">{k}</span>
      <span className="iv" style={mono ? { fontFamily: "var(--mono)", fontSize: 11 } : undefined}>{v}</span>
    </div>
  );
}

function Chip({ label, kind = "info" }: { label: string; kind?: "info" | "warn" | "ok" | "algo" }) {
  return <span className={`ichip ichip--${kind}`}>{label}</span>;
}

// ── Data-plan entity inspectors ───────────────────────────────────────────────

function TableInspector({ entity }: { entity: TableEntity }) {
  return (
    <>
      <Sec label="Table">
        <Row k="Type"        v={entity.tableType} />
        <Row k="Primary key" v={entity.primaryKey} mono />
        <Row k="Fields"      v={entity.fields.length} />
        <Row k="Description" v={entity.description} />
      </Sec>

      <Sec label="Fields">
        {entity.fields.map((f) => (
          <div key={f.id} className="irow">
            <span className="ik" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{f.name}</span>
            <span className="iv">
              {f.isPrimaryKey ? (
                <Chip label="PK" kind="warn" />
              ) : f.role === "decision" ? (
                <Chip label="decision" kind="algo" />
              ) : (
                <span style={{ color: "var(--txt3)", fontSize: 10 }}>{f.dataType}{f.mode ? ` · ${f.mode}` : ""}</span>
              )}
            </span>
          </div>
        ))}
      </Sec>

      {/* Card enrichment */}
      <div className="isec">
        <div className="isec-label isec-label--card">Table overview</div>
        <TableDiscoveryCard
          tableName={entity.name}
          sourceLabel={entity.tableType}
          rows={0}
          columns={entity.fields.length}
          status="analyzed"
        />
      </div>

      {entity.primaryKey && (
        <div className="isec">
          <div className="isec-label isec-label--card">Primary key</div>
          <KeySelectionCard
            keyName={entity.primaryKey}
            isValid={true}
            uniqueValues={0}
            totalValues={0}
            duplicates={0}
            missing={0}
          />
        </div>
      )}
    </>
  );
}

function ImportInspector({ entity }: { entity: ImportEntity }) {
  return (
    <Sec label="Import">
      <Row k="Source"    v={entity.source} />
      <Row k="Frequency" v={entity.frequency} />
      <Row k="Sync mode" v={entity.syncMode} />
    </Sec>
  );
}

function FilterInspector({ entity }: { entity: FilterEntity }) {
  return (
    <>
      <Sec label="Filter">
        <Row k="Predicate" v={entity.predicate} />
      </Sec>

      {/* Card enrichment */}
      <div className="isec">
        <div className="isec-label isec-label--card">Filter rule</div>
        <FilterRecommendationCard
          title={entity.name}
          reason={entity.predicate}
          rowsRemoved={0}
          status="applied"
        />
      </div>
    </>
  );
}

function AlgoAIInspector({ entity }: { entity: AlgoAIEntity }) {
  return (
    <Sec label="Algorithm / AI">
      <Row k="Optimization" v={entity.optimization} />
      <Row k="Promoted"     v={entity.promoted ? "yes" : "no"} />
    </Sec>
  );
}

function OutputInspector({ entity }: { entity: OutputEntity }) {
  return (
    <>
      <Sec label="Output">
        <Row k="Max rows" v={entity.maxRows} />
        <Row k="Fields"   v={entity.fields.length} />
      </Sec>
      <Sec label="Output fields">
        {entity.fields.map((f) => (
          <div key={f.id} className="irow">
            <span className="ik" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{f.name}</span>
            <span className="iv" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--txt3)" }}>
              {f.sourceFieldId}
            </span>
          </div>
        ))}
      </Sec>
    </>
  );
}

function ImpressionInspector({ entity }: { entity: ImpressionEntity }) {
  return (
    <Sec label="Impression context">
      <Row k="Fields" v={entity.fields.length} />
      {entity.fields.map((f) => (
        <div key={f.id} className="irow">
          <span className="ik" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{f.name}</span>
          <span className="iv" style={{ color: "var(--txt3)", fontSize: 10 }}>{f.dataType}</span>
        </div>
      ))}
    </Sec>
  );
}

// ── Generic fallback (media plan and anything unrecognised) ───────────────────

function GenericInspector({ entity }: { entity: AnyEntity }) {
  const entries = Object.entries(entity).filter(([k, v]) => k !== "type" && v !== undefined && v !== null && v !== "");
  return (
    <Sec label="Properties">
      {entries.map(([k, v]) => {
        if (Array.isArray(v)) return <Row key={k} k={k} v={`${v.length} items`} />;
        if (typeof v === "object") return null;
        return <Row key={k} k={k} v={String(v)} />;
      })}
    </Sec>
  );
}

// ── Kind metadata ─────────────────────────────────────────────────────────────

type IconComp = React.ComponentType<{ size?: number | string }>;

const DATA_KIND: Record<string, { label: string; css: string; Icon: IconComp }> = {
  Table:      { label: "Table",      css: "kind-table",  Icon: IconTable },
  Import:     { label: "Import",     css: "kind-import", Icon: IconCloudDownload },
  Filter:     { label: "Filter",     css: "kind-filter", Icon: IconFilter },
  AlgoAI:     { label: "Algo / AI",  css: "kind-algo",   Icon: IconCpu },
  Output:     { label: "Output",     css: "kind-output", Icon: IconArrowBarToRight },
  Impression: { label: "Impression", css: "kind-signal", Icon: IconBroadcast },
};

const MEDIA_KIND: { label: string; css: string; Icon: IconComp } = { label: "Entity", css: "kind-media", Icon: IconLayout };

function renderDataContent(entity: DataPlanEntity) {
  switch (entity.type) {
    case "Table":      return <TableInspector      entity={entity} />;
    case "Import":     return <ImportInspector     entity={entity} />;
    case "Filter":     return <FilterInspector     entity={entity} />;
    case "AlgoAI":     return <AlgoAIInspector     entity={entity} />;
    case "Output":     return <OutputInspector     entity={entity} />;
    case "Impression": return <ImpressionInspector entity={entity} />;
    default:           return <GenericInspector    entity={entity} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InspectorPanel({ planType }: { planType: "data" | "media" }) {
  const dataModel    = useStore((s) => s.dataModel());
  const mediaModel   = useStore((s) => s.mediaModel());
  const selectedId   = useStore((s) => s.selectedNodeId);
  const selectNode   = useStore((s) => s.selectNode);
  const graphSel     = useStore((s) => s.graphSelection);
  const setGraphSel  = useStore((s) => s.setGraphSelection);

  let entity: AnyEntity | null = null;
  let entityId: string | null = null;
  let kindMeta = DATA_KIND["Table"]; // fallback

  if (planType === "data") {
    entityId = selectedId;
    entity   = selectedId && dataModel ? (dataModel.entities[selectedId] ?? null) : null;
    if (entity) kindMeta = DATA_KIND[entity.type] ?? DATA_KIND["Table"];
  } else {
    entityId = graphSel.length === 1 ? graphSel[0] : null;
    entity   = entityId && mediaModel ? (mediaModel.entities[entityId] ?? null) : null;
    kindMeta = MEDIA_KIND;
    if (entity) {
      const dm = DATA_KIND[entity.type];
      if (dm) kindMeta = dm;
    }
  }

  function close() {
    if (planType === "data") selectNode(null);
    else setGraphSel([]);
  }

  if (!entity) return null;

  const { label, css, Icon } = kindMeta;
  const displayName = (entity as { name?: string }).name ?? entityId ?? label;

  return (
    <div className="inspector">
      <div className={`kind-banner ${css}`}>
        <Icon size={14} />
        <span className="kind-banner-name">{displayName}</span>
        <span className="kind-banner-type">{label}</span>
        <button className="kind-banner-close" onClick={close} title="Close inspector">
          <IconX size={13} />
        </button>
      </div>
      <div className="insp-scroll">
        {planType === "data"
          ? renderDataContent(entity as DataPlanEntity)
          : <GenericInspector entity={entity} />}
      </div>
    </div>
  );
}
