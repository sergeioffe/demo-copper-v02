import React, { useEffect, useRef, useState } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { useStore } from "./store.js";
import { APP_VERSION } from "./version.js";
import { listProjects, loadProject, createProject } from "./api.js";
import ContextPanel from "./components/ContextPanel.js";
import PlanDocument from "./components/PlanDocument.js";
import ProjectModel from "./components/ProjectModel.js";
import VersionBar from "./components/VersionBar.js";
import QAViewer from "./components/QAViewer.js";
import HistoryPanel from "./components/HistoryPanel.js";
import AdminPanel from "./components/AdminPanel.js";
import WizardSurface from "./components/WizardSurface.js";
import {
  IconAffiliate,
  IconDatabase,
  IconChartBar,
  IconPalette,
  IconChevronDown,
  IconPlus,
  IconCloud,
  IconCloudCheck,
  IconCloudX,
  IconBug,
  IconHistory,
  IconSettings,
  IconMessage,
  IconFileText,
  IconLayoutColumns,
} from "@tabler/icons-react";

const PLANS = [
  { id: "data",     label: "Data Plan",     icon: IconDatabase,  stub: false },
  { id: "media",    label: "Media Plan",    icon: IconChartBar,  stub: false },
  { id: "creative", label: "Creative Plan", icon: IconPalette,   stub: true  },
] as const;

function ResizeHandle({ getWidth, min, onResize }: { getWidth: () => number; min: number; onResize: (w: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = getWidth();
    const onMove = (ev: MouseEvent) => {
      onResize(Math.max(min, startW + (ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  return <div className="panel-resize-handle" onMouseDown={handleMouseDown} />;
}

function PanelStripe({ icon: Icon, color, title, onClick }: { icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>; color?: string; title: string; onClick: () => void }) {
  return (
    <div className="panel-stripe" onClick={onClick} title={title}>
      <Icon size={15} style={color ? { color } : undefined} />
    </div>
  );
}

function useGlobalDropGuard() {
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", stop);
    document.addEventListener("drop", stop);
    return () => {
      document.removeEventListener("dragover", stop);
      document.removeEventListener("drop", stop);
    };
  }, []);
}

function SaveButton({ status, onSave }: { status: string; onSave: () => void }) {
  if (status === "saving")
    return <span className="save-chip save-chip--saving"><IconCloud size={12} /> Saving…</span>;
  if (status === "saved")
    return <span className="save-chip save-chip--saved"><IconCloudCheck size={12} /> Saved</span>;
  return (
    <button className="save-chip save-chip--unsaved save-chip--btn" onClick={onSave}>
      <IconCloudX size={12} /> Save
    </button>
  );
}

function ProjectPicker({
  projects,
  currentId,
  onSelect,
  onNew,
}: {
  projects: Array<{ id: string; name: string }>;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = projects.find((p) => p.id === currentId);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="project-picker" ref={ref}>
      <button className="project-picker-btn" onClick={() => setOpen((v) => !v)}>
        <span className="project-picker-name">{current?.name ?? "No project"}</span>
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="project-picker-menu">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`project-picker-item${p.id === currentId ? " active" : ""}`}
              onClick={() => { onSelect(p.id); setOpen(false); }}
            >
              {p.name}
            </div>
          ))}
          <div className="project-picker-divider" />
          <div className="project-picker-item project-picker-new" onClick={() => { onNew(); setOpen(false); }}>
            <IconPlus size={12} /> New project
          </div>
        </div>
      )}
    </div>
  );
}

function NewProjectModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
    } catch (err) {
      setError((err as Error).message ?? "Failed to create project");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">New project</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="modal-input"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="modal-btn modal-btn--create" disabled={!name.trim() || busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MainApp() {
  useGlobalDropGuard();

  const location = useLocation();
  const version           = useStore((s) => s.version);
  const availableProjects = useStore((s) => s.availableProjects);
  const saveStatus        = useStore((s) => s.saveStatus);
  const activePlan        = useStore((s) => s.activePlan);
  const setActivePlan     = useStore((s) => s.setActivePlan);
  const setAvailableProjects = useStore((s) => s.setAvailableProjects);
  const loadVersionStore  = useStore((s) => s.loadVersion);
  const saveNow           = useStore((s) => s.saveNow);
  const panelFocus        = useStore((s) => s.panelFocus);
  const contextW          = useStore((s) => s.contextW);
  const planDocW          = useStore((s) => s.planDocW);
  const setPanelFocus     = useStore((s) => s.setPanelFocus);
  const setContextW       = useStore((s) => s.setContextW);
  const setPlanDocW       = useStore((s) => s.setPlanDocW);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const list = await listProjects();
        setAvailableProjects(list);
        if (list.length > 0) {
          const v = await loadProject(list[0].id);
          loadVersionStore(v);
        }
      } catch (err) {
        console.error("[app] init failed:", err);
      }
    }
    init();
  }, []);

  async function handleSelectProject(id: string) {
    try {
      const v = await loadProject(id);
      loadVersionStore(v);
    } catch (err) {
      console.error("[app] load project failed:", err);
    }
  }

  async function handleCreateProject(name: string) {
    const newVersion = await createProject(name);
    const list = await listProjects();
    setAvailableProjects(list);
    loadVersionStore(newVersion);
    setShowNewProject(false);
  }

  const isQA      = location.pathname === "/qa";
  const isHistory = location.pathname === "/history";
  const isAdmin   = location.pathname === "/admin";

  return (
    <div className="app-shell">
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={handleCreateProject}
        />
      )}

      {/* Wizard modal — overlays everything */}
      <WizardSurface />

      <div className="topbar">
        <Link to="/" className="brand" title="Back to main view">
          <IconAffiliate size={16} />
          CoPPER
          <span className="brand-v">v2</span>
        </Link>
        <span className="build-version">{APP_VERSION}</span>
        <div className="sep" />

        {version ? (
          <ProjectPicker
            projects={availableProjects}
            currentId={version.id}
            onSelect={handleSelectProject}
            onNew={() => setShowNewProject(true)}
          />
        ) : (
          <span className="proj-name muted">Loading…</span>
        )}

        <SaveButton status={saveStatus} onSave={saveNow} />

        <div className="topbar-right">
          <Link to={isHistory ? "/" : "/history"} className={`icon-btn${isHistory ? " active" : ""}`} title={isHistory ? "Back to main view" : "Version History"}>
            <IconHistory size={14} />
            Versions
          </Link>
<Link to={isQA ? "/" : "/qa"} className={`icon-btn${isQA ? " active" : ""}`} title={isQA ? "Back to main view" : "Transaction / QA Viewer"}>
            <IconBug size={14} />
            Reasoning
          </Link>
          <Link to={isAdmin ? "/" : "/admin"} className={`icon-btn icon-btn--admin${isAdmin ? " active" : ""}`} title={isAdmin ? "Back to main view" : "Admin"}>
            <IconSettings size={14} />
            Admin
          </Link>
        </div>
      </div>

      {isAdmin ? (
        <AdminPanel />
      ) : isHistory ? (
        <HistoryPanel />
      ) : isQA ? (
        <QAViewer />
      ) : (
        <div className="layout">
          {panelFocus === "context" ? (
            <>
              <ContextPanel style={{ flex: 1, width: "auto" }} />
              <PanelStripe icon={IconLayoutColumns} title="Plan & Model — click to restore" onClick={() => setPanelFocus("none")} />
            </>
          ) : (() => {
            const ctxStripe  = panelFocus === "context-min" || panelFocus === "plan" || panelFocus === "model";
            const ctxResize  = !ctxStripe;
            const planStripe = panelFocus === "plan-min"   || panelFocus === "model";
            const modelStripe= panelFocus === "model-min"  || panelFocus === "plan";
            const planFlex   = panelFocus === "plan"       || panelFocus === "model-min";
            const subResize  = panelFocus === "none"       || panelFocus === "context-min";
            return (
              <>
                {ctxStripe ? (
                  <PanelStripe icon={IconMessage} color="var(--blue-txt)" title="Chat — click to restore" onClick={() => setPanelFocus("none")} />
                ) : (
                  <ContextPanel style={{ width: contextW, flexShrink: 0 }} />
                )}
                {ctxResize && <ResizeHandle getWidth={() => contextW} min={180} onResize={setContextW} />}
                <div className="plan-region">
                  <div className="tabbar">
                    {PLANS.map((p) => (
                      <div
                        key={p.id}
                        className={`tab${activePlan === p.id ? " active" : ""}${p.stub ? " tab--stub" : ""}`}
                        onClick={() => !p.stub && setActivePlan(p.id as "data" | "media" | "creative")}
                        title={p.stub ? "Coming soon" : undefined}
                      >
                        <p.icon size={13} />
                        {p.label}
                      </div>
                    ))}
                    <span className="tab-note">tabs are projections of one version · may overlap</span>
                  </div>
                  <VersionBar />
                  <div className="subpanels">
                    {planStripe ? (
                      <PanelStripe icon={IconFileText} color="var(--teal-txt)" title="Plan — click to restore" onClick={() => setPanelFocus("none")} />
                    ) : (
                      <PlanDocument style={planFlex ? { flex: 1, width: "auto" } : { width: planDocW, flexShrink: 0 }} />
                    )}
                    {subResize && <ResizeHandle getWidth={() => planDocW} min={180} onResize={setPlanDocW} />}
                    {modelStripe ? (
                      <PanelStripe icon={IconAffiliate} color="var(--amber-txt)" title="Model — click to restore" onClick={() => setPanelFocus("none")} />
                    ) : (
                      <ProjectModel />
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<MainApp />} />
    </Routes>
  );
}
