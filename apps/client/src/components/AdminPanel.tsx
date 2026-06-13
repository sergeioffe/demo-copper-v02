import React, { useEffect, useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  adminList, adminReadFile, adminWriteFile,
  adminKBVersions, adminKBCut, adminKBVersionFiles, adminKBVersionFile, adminKBRollback,
  adminQARun, adminQAFetchKBFiles, adminQAPropose,
  seedCards, getCardHistory, getCardVersion, rollbackCard,
  type KBVersionMeta, type QARunResult, type QAJudgeResult, type CardDefinition, type CardVersionEntry,
} from "../api.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryFormatJSON(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

// ── Knowledge Base Tab (version-aware) ───────────────────────────────────────

type FileTarget =
  | { source: "wc"; folder: string; file: string }
  | { source: "ver"; realId: string; name: string; label: string };

function KBTab() {
  // Working copy tree
  const [wcFolders, setWcFolders]     = useState<string[]>([]);
  const [wcFiles, setWcFiles]         = useState<Record<string, string[]>>({});
  const [expandedWc, setExpandedWc]   = useState<Set<string>>(new Set());

  // Version history
  const [versions, setVersions]         = useState<KBVersionMeta[]>([]);
  const [loadingVers, setLoadingVers]   = useState(true);
  const [expandedVer, setExpandedVer]   = useState<Set<string>>(new Set());
  const [verFiles, setVerFiles]         = useState<Record<string, string[]>>({});

  // Editor
  const [target, setTarget]             = useState<FileTarget | null>(null);
  const [savedContent, setSavedContent] = useState("");
  const [editContent, setEditContent]   = useState("");
  const [loadingFile, setLoadingFile]   = useState(false);
  const readOnly = target?.source === "ver";

  // Save / cut state
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState<string | null>(null);
  const [showCut, setShowCut]         = useState(false);
  const [cutLabel, setCutLabel]       = useState("");
  const [cutDesc, setCutDesc]         = useState("");

  const loadVersions = useCallback(async () => {
    setLoadingVers(true);
    try {
      const { versions: v } = await adminKBVersions();
      setVersions(v);
    } catch { /* GCS may be unavailable in local mode */ }
    finally { setLoadingVers(false); }
  }, []);

  useEffect(() => {
    adminList("knowledge").then((r) => {
      const folders = r.folders.filter((f) => f !== "versions" && f !== "ux-cards");
      setWcFolders(folders);
      // pre-expand the first folder
      if (folders.length > 0) {
        setExpandedWc(new Set([folders[0]]));
        adminList(`knowledge/${folders[0]}`).then((r2) =>
          setWcFiles((prev) => ({ ...prev, [folders[0]]: r2.files.filter((f) => f.endsWith(".md")) })),
        );
      }
    });
    loadVersions();
  }, [loadVersions]);

  async function toggleWcFolder(folder: string) {
    if (!wcFiles[folder]) {
      const r = await adminList(`knowledge/${folder}`);
      setWcFiles((prev) => ({ ...prev, [folder]: r.files.filter((f) => f.endsWith(".md")) }));
    }
    setExpandedWc((prev) => {
      const n = new Set(prev);
      n.has(folder) ? n.delete(folder) : n.add(folder);
      return n;
    });
  }

  async function openWcFile(folder: string, file: string) {
    const path = `knowledge/${folder}/${file}`;
    setTarget({ source: "wc", folder, file });
    setLoadingFile(true); setSavedContent(""); setEditContent("");
    const r = await adminReadFile(path);
    setSavedContent(r.content); setEditContent(r.content);
    setLoadingFile(false);
  }

  async function toggleVer(realId: string) {
    if (!verFiles[realId]) {
      const { files } = await adminKBVersionFiles(realId);
      setVerFiles((prev) => ({ ...prev, [realId]: files }));
    }
    setExpandedVer((prev) => {
      const n = new Set(prev);
      n.has(realId) ? n.delete(realId) : n.add(realId);
      return n;
    });
  }

  async function openVerFile(realId: string, name: string, label: string) {
    setTarget({ source: "ver", realId, name, label });
    setLoadingFile(true); setSavedContent(""); setEditContent("");
    const r = await adminKBVersionFile(realId, name);
    setSavedContent(r.content); setEditContent(r.content);
    setLoadingFile(false);
  }

  async function handleSave() {
    if (!target || target.source !== "wc") return;
    setSaving(true); setSaveMsg(null);
    try {
      await adminWriteFile(`knowledge/${target.folder}/${target.file}`, editContent);
      setSavedContent(editContent);
      setSaveMsg("Saved — KB reloaded");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveMsg(`Error: ${(err as Error).message}`);
    } finally { setSaving(false); }
  }

  async function handleCutVersion() {
    if (!cutLabel.trim() || !cutDesc.trim()) return;
    setSaving(true);
    try {
      await adminKBCut(cutLabel.trim(), cutDesc.trim(), "human");
      setShowCut(false); setCutLabel(""); setCutDesc("");
      await loadVersions();
      setSaveMsg(`Version ${cutLabel.trim()} cut`);
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (err) {
      setSaveMsg(`Error: ${(err as Error).message}`);
    } finally { setSaving(false); }
  }

  async function handleRollback(meta: KBVersionMeta) {
    if (!confirm(`Roll back to v${meta.label} "${meta.description}"?\nWorking copy will be overwritten and KB reloaded.`)) return;
    try {
      await adminKBRollback(meta.realId);
      setSaveMsg(`Rolled back to v${meta.label}`);
      setTimeout(() => setSaveMsg(null), 3000);
      // reload working copy file if it was open
      if (target?.source === "wc") {
        const r = await adminReadFile(`knowledge/${target.folder}/${target.file}`);
        setSavedContent(r.content); setEditContent(r.content);
      }
    } catch (err) {
      setSaveMsg(`Error: ${(err as Error).message}`);
    }
  }

  const dirty = editContent !== savedContent;

  // Build version tree: active + superseded branches grouped by label
  const activeVers = versions.filter((v) => !v.superseded).sort((a, b) => b.realId.localeCompare(a.realId));
  const supersededByLabel: Record<string, KBVersionMeta[]> = {};
  versions.filter((v) => v.superseded).forEach((v) => { (supersededByLabel[v.label] ??= []).push(v); });

  const displayPath = target
    ? target.source === "wc"
      ? `knowledge/${target.folder}/${target.file}`
      : `v${target.label} / ${target.name}`
    : null;

  return (
    <div className="admin-layout">
      {/* ── Left sidebar ── */}
      <div className="admin-sidebar">

        {/* Working copy — always first, labeled CURRENT */}
        <div className="admin-ver-row admin-ver-row--wc">
          <span className="admin-tree-icon">📂</span>
          Working copy
          <span className="admin-cur-badge">CURRENT</span>
        </div>
        {wcFolders.map((folder) => (
          <div key={folder}>
            <div className="admin-folder-hdr" onClick={() => toggleWcFolder(folder)}>
              <span className="admin-tree-icon">{expandedWc.has(folder) ? "▾" : "▸"}</span>
              {folder}
            </div>
            {expandedWc.has(folder) && (wcFiles[folder] ?? []).map((file) => {
              const sel = target?.source === "wc" && target.folder === folder && target.file === file;
              return (
                <div key={file} className={`admin-file-row${sel ? " sel" : ""}`} onClick={() => openWcFile(folder, file)}>
                  <span className="admin-tree-icon admin-tree-icon--file">·</span>
                  {file}
                </div>
              );
            })}
          </div>
        ))}

        {/* Version history section */}
        {!loadingVers && (
          <div className="admin-ver-section">Version History</div>
        )}
        {loadingVers && (
          <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--txt3)" }}>Loading…</div>
        )}

        {activeVers.map((ver) => {
          const expanded = expandedVer.has(ver.realId);
          const files = verFiles[ver.realId] ?? [];
          const branches = supersededByLabel[ver.label] ?? [];
          return (
            <div key={ver.realId}>
              <div className="admin-ver-row" onClick={() => toggleVer(ver.realId)}>
                <span className="admin-tree-icon">{expanded ? "▾" : "▸"}</span>
                <span className="admin-ver-label">v{ver.label}</span>
                <span className="admin-ver-desc">{ver.description}</span>
              </div>
              {expanded && files.map((name) => {
                const sel = target?.source === "ver" && target.realId === ver.realId && target.name === name;
                return (
                  <div key={name} className={`admin-file-row${sel ? " sel" : ""}`}
                    style={{ paddingLeft: 32 }}
                    onClick={() => openVerFile(ver.realId, name, ver.label)}>
                    <span className="admin-tree-icon admin-tree-icon--file">·</span>
                    {name.split("/").pop()}
                  </div>
                );
              })}
              {expanded && (
                <div style={{ paddingLeft: 28 }}>
                  <button
                    onClick={() => handleRollback(ver)}
                    style={{ fontSize: 10, background: "none", border: "1px solid var(--b2)", borderRadius: 3, padding: "2px 8px", cursor: "pointer", color: "var(--txt3)", margin: "4px 0 4px 0" }}
                  >
                    ↩ Rollback to this version
                  </button>
                </div>
              )}
              {branches.length > 0 && (
                <details>
                  <summary className="admin-branch-summary">Unused Branch {ver.label}</summary>
                  {branches.map((b) => (
                    <div key={b.realId} className="admin-ver-row admin-ver-row--branch"
                      onClick={() => toggleVer(b.realId)}>
                      <span className="admin-tree-icon">{expandedVer.has(b.realId) ? "▾" : "▸"}</span>
                      <span className="admin-ver-desc">{b.description}</span>
                    </div>
                  ))}
                </details>
              )}
            </div>
          );
        })}

        {!loadingVers && versions.length === 0 && (
          <div style={{ padding: "10px 12px", fontSize: 10.5, color: "var(--txt3)", fontStyle: "italic" }}>
            No versions yet — use ✂️ Cut Version to snapshot the working copy.
          </div>
        )}
      </div>

      {/* ── Right: editor ── */}
      <div className="admin-editor">
        {displayPath ? (
          <>
            <div className="admin-editor-hdr">
              <span className="admin-path">{displayPath}</span>
              {readOnly && <span className="admin-ro-badge">snapshot — read only</span>}
              {saveMsg && (
                <span className={`admin-save-msg${saveMsg.startsWith("Error") ? " admin-save-msg--err" : ""}`}>
                  {saveMsg}
                </span>
              )}
              {!readOnly && (
                <>
                  <button className="admin-save-btn" disabled={!dirty || saving || loadingFile} onClick={handleSave}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button className="admin-save-btn admin-save-btn--cut" onClick={() => setShowCut(true)}>
                    ✂️ Cut Version
                  </button>
                </>
              )}
            </div>
            <div className="admin-editor-cm">
              {loadingFile ? (
                <div className="admin-loading">Loading…</div>
              ) : (
                <CodeMirror
                  value={editContent}
                  onChange={readOnly ? undefined : (v) => setEditContent(v)}
                  extensions={[markdown()]}
                  theme={oneDark}
                  style={{ height: "100%", fontSize: 12 }}
                  editable={!readOnly}
                />
              )}
            </div>
          </>
        ) : (
          <div className="admin-empty">
            Select a file from the working copy (editable) or a version snapshot (read-only)
          </div>
        )}
      </div>

      {/* ── Cut Version modal ── */}
      {showCut && (
        <div className="modal-backdrop" onClick={() => setShowCut(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Cut a Version</div>
            <p style={{ fontSize: 12.5, color: "var(--txt2)", margin: "0 0 16px", lineHeight: 1.5 }}>
              Snapshot the current working copy as an immutable version.
              Old versions with the same label become "Unused Branch N".
            </p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Label</label>
              <input className="modal-input" placeholder="e.g. 1, 2, 5" value={cutLabel}
                onChange={(e) => setCutLabel(e.target.value)} />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>Description</label>
              <input className="modal-input" placeholder="What changed in this snapshot"
                value={cutDesc} onChange={(e) => setCutDesc(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn--cancel" onClick={() => setShowCut(false)}>Cancel</button>
              <button className="modal-btn modal-btn--create"
                disabled={!cutLabel.trim() || !cutDesc.trim() || saving}
                onClick={handleCutVersion}>
                {saving ? "Snapshotting…" : "Cut Version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QA Agent Tab ──────────────────────────────────────────────────────────────

interface ProposedFile { path: string; content: string; original: string; }

type QAPhase =
  | { tag: "idle" }
  | { tag: "running"; label: string }
  | { tag: "tested"; run: QARunResult; judge: QAJudgeResult }
  | { tag: "dryrun"; run: QARunResult; judge: QAJudgeResult; proposed: ProposedFile[] }
  | { tag: "approving" }
  | { tag: "approved" }
  | { tag: "error"; message: string };

function QAAgentTab({ onSwitchToKB }: { onSwitchToKB: () => void }) {
  const [phase, setPhase] = useState<QAPhase>({ tag: "idle" });
  const [prompt, setPrompt] = useState("");
  const [expected, setExpected] = useState("");

  function reset() { setPhase({ tag: "idle" }); }

  async function handleRun(kbOverride?: Array<{ path: string; content: string }>) {
    setPhase({ tag: "running", label: kbOverride ? "Dry-run with proposed KB…" : "Running test and judging…" });
    try {
      const [run, kbFiles] = await Promise.all([
        adminQARun(prompt, kbOverride),
        kbOverride ? Promise.resolve(kbOverride) : adminQAFetchKBFiles(),
      ]);
      const judge = await adminQAPropose(prompt, expected, run, kbFiles);
      if (kbOverride) {
        setPhase({ tag: "dryrun", run, judge, proposed: judge.proposedFiles.length ? judge.proposedFiles : kbOverride.map(f => ({ ...f, original: "" })) });
      } else {
        setPhase({ tag: "tested", run, judge });
      }
    } catch (err) {
      setPhase({ tag: "error", message: (err as Error).message });
    }
  }

  async function handleApprove(files: ProposedFile[]) {
    setPhase({ tag: "approving" });
    try {
      for (const f of files) {
        await adminWriteFile(f.path, f.content);
      }
      setPhase({ tag: "approved" });
    } catch (err) {
      setPhase({ tag: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="admin-qa-body">
      <p style={{ fontSize: 12, color: "var(--txt3)", margin: "0 0 20px", lineHeight: 1.5 }}>
        Assert prompt behavior → auto-propose KB fix → dry-run → approve to working copy.
        Then use <button onClick={onSwitchToKB}
          style={{ background: "none", border: "none", color: "var(--blue-txt)", cursor: "pointer", padding: 0, fontSize: 12, textDecoration: "underline" }}>
          Knowledge Base
        </button> → ✂️ Cut Version when you're ready to snapshot.
      </p>

      {/* ── IDLE ── */}
      {phase.tag === "idle" && (
        <div>
          <div style={{ marginBottom: 14 }}>
            <label className="admin-qa-label">Test Prompt</label>
            <textarea className="admin-qa-textarea" rows={4} value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="New project — add an Impression, activate by zip using a Products table, show recommendations" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label className="admin-qa-label">Expected Output (plain language)</label>
            <textarea className="admin-qa-textarea admin-qa-textarea--plain" rows={3} value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Should produce: Impression entity, one Products table (sku/name/price/image), Filter or AlgoAI, Output entity" />
          </div>
          <button className="admin-qa-btn admin-qa-btn--primary"
            disabled={!prompt.trim() || !expected.trim()}
            onClick={() => handleRun()}>
            Run Test
          </button>
        </div>
      )}

      {/* ── RUNNING ── */}
      {phase.tag === "running" && (
        <div style={{ color: "var(--txt3)", padding: "32px 0", fontSize: 13 }}>⏳ {phase.label}</div>
      )}
      {phase.tag === "approving" && (
        <div style={{ color: "var(--txt3)", padding: "32px 0", fontSize: 13 }}>⏳ Writing KB changes and reloading…</div>
      )}

      {/* ── TESTED ── */}
      {(phase.tag === "tested" || phase.tag === "dryrun") && (() => {
        const run = phase.run;
        const judge = phase.judge;
        const isDry = phase.tag === "dryrun";
        const proposed = isDry ? phase.proposed : judge.proposedFiles;
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              {isDry && <span className="admin-qa-badge admin-qa-badge--dryrun">DRY RUN</span>}
              <span className={`admin-qa-badge ${judge.judgment === "pass" ? "admin-qa-badge--pass" : "admin-qa-badge--fail"}`}>
                {judge.judgment === "pass" ? "✅ PASS" : "❌ FAIL"}
              </span>
              <span style={{ fontSize: 12, color: "var(--txt3)" }}>{run.ops.length} ops · {run.systemPromptLength} char prompt</span>
              <button className="admin-qa-btn admin-qa-btn--ghost" style={{ marginLeft: "auto" }} onClick={reset}>Reset</button>
            </div>

            <details style={{ marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--txt2)", fontWeight: 600, marginBottom: 6 }}>
                Ops ({run.ops.length})
              </summary>
              <pre className="admin-qa-pre">{JSON.stringify(run.ops, null, 2)}</pre>
            </details>
            <details style={{ marginBottom: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--txt2)", fontWeight: 600, marginBottom: 6 }}>
                Reasoning
              </summary>
              <pre className="admin-qa-pre">{JSON.stringify(run.reasoning, null, 2)}</pre>
            </details>

            {judge.diagnosis && (
              <div className="admin-qa-diag" style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Diagnosis</div>
                {judge.diagnosis}
              </div>
            )}

            {judge.judgment === "pass" && (
              <div style={{ color: "var(--green-txt)", fontWeight: 600, fontSize: 13 }}>
                KB looks correct for this case.{isDry ? " Fix verified." : ""}
              </div>
            )}

            {judge.proposedFiles.length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 12, margin: "16px 0 10px" }}>
                  {isDry ? "Files to be approved:" : "Proposed Changes:"}
                </div>
                {proposed.map((f, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--txt2)", marginBottom: 6, fontFamily: "var(--mono)" }}>
                      📄 {f.path}
                    </div>
                    <div className="admin-qa-diff-grid">
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--txt3)", marginBottom: 4 }}>Current</div>
                        <pre className="admin-qa-diff-pre admin-qa-diff-pre--old">{f.original}</pre>
                      </div>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--txt3)", marginBottom: 4 }}>Proposed</div>
                        <pre className="admin-qa-diff-pre admin-qa-diff-pre--new">{f.content}</pre>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  {!isDry && (
                    <button className="admin-qa-btn admin-qa-btn--primary"
                      onClick={() => handleRun(proposed.map(f => ({ path: f.path, content: f.content })))}>
                      🔁 Dry-Run Retest
                    </button>
                  )}
                  <button
                    className={`admin-qa-btn ${judge.judgment === "pass" ? "admin-qa-btn--green" : "admin-qa-btn--orange"}`}
                    onClick={() => handleApprove(proposed)}>
                    {judge.judgment === "pass" ? "✅ Approve & Write KB" : "⚠️ Approve Anyway"}
                  </button>
                  <button className="admin-qa-btn admin-qa-btn--ghost" onClick={reset}>Reject</button>
                </div>
              </>
            )}

            {judge.judgment === "fail" && judge.proposedFiles.length === 0 && (
              <div style={{ color: "var(--coral-txt)", fontSize: 12 }}>
                Failure detected but no fix proposed. Review reasoning above.
              </div>
            )}
          </div>
        );
      })()}

      {/* ── APPROVED ── */}
      {phase.tag === "approved" && (
        <div>
          <div style={{ color: "var(--green-txt)", fontWeight: 600, marginBottom: 10, fontSize: 13 }}>
            ✅ Working copy updated. Server KB reloaded.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="admin-qa-btn admin-qa-btn--ghost" onClick={reset}>Run another test</button>
            <button className="admin-qa-btn admin-qa-btn--primary" onClick={onSwitchToKB}>→ Cut a Version</button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase.tag === "error" && (
        <div>
          <pre className="admin-qa-pre" style={{ color: "var(--coral-txt)", marginBottom: 12 }}>{phase.message}</pre>
          <button className="admin-qa-btn admin-qa-btn--ghost" onClick={reset}>Reset</button>
        </div>
      )}
    </div>
  );
}

// ── Projects Tab (unchanged) ──────────────────────────────────────────────────

type NodeKind = "project" | "version" | "txn-root" | "pass" | "file";

interface TreeNode {
  id: string; depth: number; label: string; path: string; kind: NodeKind; isFile: boolean;
}

function ProjectsTab() {
  const [roots, setRoots]       = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent]   = useState<string | null>(null);
  const [loadingFile, setLoadingFile]   = useState(false);

  useEffect(() => {
    adminList("project_data").then((r) => {
      setRoots(r.folders.sort().map((f) => ({
        id: `p:${f}`, depth: 0, label: f, path: `project_data/${f}`, kind: "project", isFile: false,
      })));
    });
  }, []);

  const loadChildren = useCallback(async (node: TreeNode): Promise<TreeNode[]> => {
    const r = await adminList(node.path);
    const kids: TreeNode[] = [];
    const d = node.depth + 1;
    if (node.kind === "project") {
      r.folders.filter((f) => /^ver\d+$/.test(f)).sort().forEach((f) =>
        kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "version", isFile: false })
      );
    } else if (node.kind === "version") {
      if (r.files.includes("project.json"))
        kids.push({ id: `${node.id}/pj`, depth: d, label: "project.json", path: `${node.path}/project.json`, kind: "file", isFile: true });
      if (r.folders.includes("transactions"))
        kids.push({ id: `${node.id}/txn`, depth: d, label: "transactions/", path: `${node.path}/transactions`, kind: "txn-root", isFile: false });
    } else if (node.kind === "txn-root") {
      r.folders.sort().forEach((f) =>
        kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "pass", isFile: false })
      );
    } else if (node.kind === "pass") {
      r.files.filter((f) => f.endsWith(".json")).sort().forEach((f) =>
        kids.push({ id: `${node.id}/${f}`, depth: d, label: f, path: `${node.path}/${f}`, kind: "file", isFile: true })
      );
    }
    return kids;
  }, []);

  async function toggle(node: TreeNode) {
    if (expanded.has(node.id)) {
      setExpanded((e) => { const n = new Set(e); n.delete(node.id); return n; });
      return;
    }
    if (!children[node.id]) {
      const kids = await loadChildren(node);
      setChildren((c) => ({ ...c, [node.id]: kids }));
    }
    setExpanded((e) => new Set([...e, node.id]));
  }

  async function openFile(node: TreeNode) {
    setSelectedPath(node.path); setFileContent(null); setLoadingFile(true);
    const r = await adminReadFile(node.path);
    setFileContent(tryFormatJSON(r.content)); setLoadingFile(false);
  }

  function flatten(nodes: TreeNode[]): TreeNode[] {
    const result: TreeNode[] = [];
    for (const n of nodes) {
      result.push(n);
      if (expanded.has(n.id) && children[n.id]) result.push(...flatten(children[n.id]));
    }
    return result;
  }

  const flat = flatten(roots);

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        {flat.length === 0 && <div className="admin-empty-sidebar">No projects found</div>}
        {flat.map((node) => (
          <div key={node.id}
            className={`admin-tree-row${node.isFile ? " admin-tree-row--file" : ""}${selectedPath === node.path ? " sel" : ""}`}
            style={{ paddingLeft: `${8 + node.depth * 14}px` }}
            onClick={() => node.isFile ? openFile(node) : toggle(node)}>
            <span className="admin-tree-icon">{node.isFile ? "·" : expanded.has(node.id) ? "▾" : "▸"}</span>
            <span className={`admin-tree-label admin-tree-label--${node.kind}`}>{node.label}</span>
          </div>
        ))}
      </div>
      <div className="admin-viewer">
        {loadingFile ? <div className="admin-loading">Loading…</div>
          : fileContent !== null ? <pre className="admin-json">{fileContent}</pre>
          : <div className="admin-empty">Select a file to view</div>}
      </div>
    </div>
  );
}

// ── Cards Tab ────────────────────────────────────────────────────────────────

function CardsTab() {
  const [defs, setDefs] = useState<CardDefinition[] | null>(null);
  const [source, setSource] = useState<string>("—");
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardDefinition | null>(null);
  const [history, setHistory] = useState<CardVersionEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<{ v: string; definition: CardDefinition } | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const displayDef = viewingVersion?.definition ?? selected;

  async function loadHistory(cardType: string) {
    setHistoryLoading(true);
    setHistory([]);
    try {
      const r = await getCardHistory(cardType);
      setHistory(r.history);
    } catch { /* GCS unavailable */ }
    finally { setHistoryLoading(false); }
  }

  async function selectCard(def: CardDefinition) {
    setSelected(def);
    setViewingVersion(null);
    await loadHistory(def.cardType);
  }

  async function refresh() {
    setSeedResult(null);
    setDefs(null);
    try {
      const res = await fetch("/api/cards/definitions");
      const src = res.headers.get("X-Cards-Source") ?? "unknown";
      setSource(src);
      const data = await res.json() as { definitions: CardDefinition[] };
      setDefs(data.definitions);
      if (data.definitions.length > 0 && !selected) await selectCard(data.definitions[0]);
    } catch {
      setDefs([]);
    }
  }

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSeed() {
    setSeeding(true);
    setSeedResult(null);
    try {
      const r = await seedCards();
      setSeedResult(`Seeded ${r.written.length} files to GCS.`);
      await refresh();
      if (selected) await loadHistory(selected.cardType);
    } catch (err) {
      setSeedResult(`Error: ${(err as Error).message}`);
    } finally {
      setSeeding(false);
    }
  }

  async function handleViewVersion(v: string) {
    if (!selected) return;
    try {
      const r = await getCardVersion(selected.cardType, v);
      setViewingVersion({ v: r.v, definition: r.definition });
    } catch { /* ignore */ }
  }

  async function handleRollback(v: string) {
    if (!selected) return;
    if (!confirm(`Roll back ${selected.cardType} to v${v}?\nThis creates a new version entry with v${v}'s content.`)) return;
    setRollingBack(v);
    try {
      const r = await rollbackCard(selected.cardType, v);
      setSeedResult(`Rolled back to v${v} — recorded as v${r.newVersion}.`);
      setViewingVersion(null);
      await loadHistory(selected.cardType);
    } catch (err) {
      setSeedResult(`Error: ${(err as Error).message}`);
    } finally {
      setRollingBack(null);
    }
  }

  // History shown newest-first
  const historyDesc = [...history].reverse();
  const latestV = historyDesc[0]?.v;

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div style={{ padding: "10px 12px 6px", borderBottom: "1px solid var(--b)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--txt3)" }}>
              Source: <strong style={{ color: source === "gcs" ? "var(--green-txt)" : "var(--amber-txt)" }}>{source}</strong>
            </span>
            <button className="admin-qa-btn admin-qa-btn--ghost" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => void refresh()}>↺</button>
          </div>
          <button
            className={`admin-qa-btn ${source === "gcs" ? "admin-qa-btn--ghost" : "admin-qa-btn--primary"}`}
            style={{ width: "100%" }}
            disabled={seeding}
            onClick={handleSeed}>
            {seeding ? "Seeding…" : source === "gcs" ? "Re-seed to GCS" : "Seed to GCS"}
          </button>
          {seedResult && (
            <div style={{ fontSize: 11, marginTop: 6, color: seedResult.startsWith("Error") ? "var(--coral-txt)" : "var(--green-txt)" }}>
              {seedResult}
            </div>
          )}
        </div>
        {defs === null && <div className="admin-loading" style={{ padding: 12 }}>Loading…</div>}
        {defs !== null && defs.map((d) => (
          <div key={d.cardType}
            className={`admin-tree-row admin-tree-row--file${selected?.cardType === d.cardType ? " sel" : ""}`}
            onClick={() => void selectCard(d)}>
            <span className="admin-tree-icon">·</span>
            <span className="admin-tree-label" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{d.cardType}</span>
          </div>
        ))}
      </div>

      <div className="admin-viewer" style={{ padding: 16, overflowY: "auto" }}>
        {!displayDef ? (
          <div className="admin-empty">Select a card definition</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12 }}>

            {/* Snapshot banner — shown when browsing a historical version */}
            {viewingVersion && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--b2)", borderRadius: 6 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--blue-txt)" }}>v{viewingVersion.v}</span>
                <span style={{ fontSize: 11, color: "var(--txt3)" }}>snapshot — read only</span>
                <button className="admin-qa-btn admin-qa-btn--ghost" style={{ marginLeft: "auto", fontSize: 10 }} onClick={() => setViewingVersion(null)}>
                  ↑ Back to current
                </button>
                <button
                  className="admin-qa-btn admin-qa-btn--ghost"
                  style={{ fontSize: 10 }}
                  disabled={rollingBack !== null}
                  onClick={() => void handleRollback(viewingVersion.v)}>
                  {rollingBack === viewingVersion.v ? "Rolling back…" : "↩ Rollback"}
                </button>
              </div>
            )}

            {/* Definition fields */}
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>cardType</div>
              <code style={{ fontFamily: "var(--mono)", color: "var(--blue-txt)" }}>{displayDef.cardType}</code>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>allowedActions</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {displayDef.allowedActions.map((a) => (
                  <span key={a} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg3)", border: "1px solid var(--b2)", fontFamily: "var(--mono)" }}>{a}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>whenToUse</div>
              <p style={{ color: "var(--txt2)", lineHeight: 1.6 }}>{displayDef.whenToUse}</p>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>whenNotToUse</div>
              <p style={{ color: "var(--txt2)", lineHeight: 1.6 }}>{displayDef.whenNotToUse}</p>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>fallbackText</div>
              <p style={{ color: "var(--txt3)", fontStyle: "italic", lineHeight: 1.6 }}>{displayDef.fallbackText}</p>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>propsSchema</div>
              <pre className="admin-qa-pre" style={{ fontSize: 10 }}>{JSON.stringify(displayDef.propsSchema, null, 2)}</pre>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 3 }}>exampleProps</div>
              <pre className="admin-qa-pre" style={{ fontSize: 10 }}>{JSON.stringify(displayDef.exampleProps, null, 2)}</pre>
            </div>

            {/* Version history — only shown when viewing current definition */}
            {!viewingVersion && (
              <div style={{ borderTop: "1px solid var(--b)", paddingTop: 14 }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--txt3)", fontWeight: 700, marginBottom: 10 }}>
                  Version History
                </div>
                {historyLoading && <div style={{ fontSize: 11, color: "var(--txt3)" }}>Loading…</div>}
                {!historyLoading && historyDesc.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--txt3)", fontStyle: "italic" }}>
                    No versions yet — use Re-seed to GCS to record v0001.
                  </div>
                )}
                {!historyLoading && historyDesc.map((entry) => (
                  <div key={entry.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--b)", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: entry.v === latestV ? "var(--green-txt)" : "var(--txt2)", minWidth: 36 }}>
                      v{entry.v}
                    </span>
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--bg3)", border: "1px solid var(--b2)", color: "var(--txt3)", fontFamily: "var(--mono)" }}>
                      {entry.by}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--txt3)" }}>
                      {new Date(entry.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {entry.note && (
                      <span style={{ fontSize: 10, color: "var(--txt3)", fontStyle: "italic", flex: 1 }}>{entry.note}</span>
                    )}
                    <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                      <button className="admin-qa-btn admin-qa-btn--ghost" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => void handleViewVersion(entry.v)}>
                        View
                      </button>
                      <button
                        className="admin-qa-btn admin-qa-btn--ghost"
                        style={{ fontSize: 10, padding: "2px 8px" }}
                        disabled={rollingBack !== null}
                        onClick={() => void handleRollback(entry.v)}>
                        {rollingBack === entry.v ? "…" : "↩"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Panel shell ─────────────────────────────────────────────────────────

type AdminTab = "kb" | "qa" | "cards" | "projects";

export default function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>("kb");
  return (
    <div className="admin-shell">
      <div className="admin-header">
        <span className="admin-title">Admin</span>
        <div className="admin-tabbar">
          <button className={`admin-tab${tab === "kb" ? " active" : ""}`} onClick={() => setTab("kb")}>
            Knowledge Base
          </button>
          <button className={`admin-tab${tab === "qa" ? " active" : ""}`} onClick={() => setTab("qa")}>
            KB QA Agent
          </button>
          <button className={`admin-tab${tab === "cards" ? " active" : ""}`} onClick={() => setTab("cards")}>
            Cards
          </button>
          <button className={`admin-tab${tab === "projects" ? " active" : ""}`} onClick={() => setTab("projects")}>
            Projects
          </button>
        </div>
      </div>
      <div className="admin-body">
        {tab === "kb"       && <KBTab />}
        {tab === "qa"       && <QAAgentTab onSwitchToKB={() => setTab("kb")} />}
        {tab === "cards"    && <CardsTab />}
        {tab === "projects" && <ProjectsTab />}
      </div>
    </div>
  );
}
