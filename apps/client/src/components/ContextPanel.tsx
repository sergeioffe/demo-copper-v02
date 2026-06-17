import React, { useRef, useEffect, useState } from "react";
import { useStore } from "../store.js";
import type { ActivePlan } from "../store.js";
import ProposalCard from "./ProposalCard.js";
import { CardPlayer } from "./cards/CardPlayer.js";
import { chat, getLibrary, putLibrary, uploadLibraryContent } from "../api.js";
import { classifyFile } from "../lib/parseContextFile.js";
import { useDocumentHandlers } from "../hooks/useDocumentHandlers.js";
import { IconMessage, IconArrowUp, IconCloudUpload, IconPlus, IconX, IconArrowsMaximize, IconArrowsMinimize, IconMinus } from "@tabler/icons-react";
import type { PanelFocus } from "../store.js";
import type { Exchange, LibraryFile } from "@copper/contracts";
import LibraryShelf from "./library/LibraryShelf.js";
import LibraryTakeover from "./library/LibraryTakeover.js";

const LLM_MODELS = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8",   label: "Claude Opus 4.8"   },
  { id: "gpt-5.5",           label: "GPT-5.5"           },
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro"    },
];

const PLAN_LABELS: Record<ActivePlan, string> = {
  data: "Data", media: "Media", creative: "Creative",
};

// ── Menu items (data-driven, context-filtered) ────────────────────────────────

interface MenuItemDef {
  id: string;
  getLabel: (plan: ActivePlan) => string;
  visible: (plan: ActivePlan) => boolean;
  accept: string;
  multiple: boolean;
  route: "wizard" | "library" | "plan";
}

const MENU_ITEM_DEFS: MenuItemDef[] = [
  {
    id: "add-table",
    getLabel: () => "Add Table to Data-Model",
    visible: (p) => p === "data",
    accept: ".csv,.json,.xlsx,.xls",
    multiple: false,
    route: "wizard",
  },
  {
    id: "upload-plan",
    getLabel: (p) => `Upload a ${PLAN_LABELS[p]} Plan`,
    visible: () => true,
    accept: "*",
    multiple: false,
    route: "plan",
  },
  {
    id: "add-library",
    getLabel: () => "Add File(s) to Library",
    visible: () => true,
    accept: "*",
    multiple: true,
    route: "library",
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  file?: File; // present for files dropped on chat; uploaded to library on submit
}

interface DisambigState {
  file: File;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContextPanel({ style }: { style?: React.CSSProperties }) {
  const version            = useStore((s) => s.version);
  const exchanges          = useStore((s) => s.version?.context.exchanges) ?? [];
  const contextFiles       = useStore((s) => s.version?.context.contextFiles) ?? [];
  const activePlan         = useStore((s) => s.activePlan);
  const isLoading          = useStore((s) => s.isLoading);
  const llmModel           = useStore((s) => s.llmModel);
  const setLlmModel        = useStore((s) => s.setLlmModel);
  const appendExchanges    = useStore((s) => s.appendExchanges);
  const mergeServerVersion = useStore((s) => s.mergeServerVersion);
  const setLoading         = useStore((s) => s.setLoading);
  const openWizard         = useStore((s) => s.openWizard);
  const libraryFiles       = useStore((s) => s.libraryFiles);
  const libraryFolders     = useStore((s) => s.libraryFolders);
  const libraryOpen        = useStore((s) => s.libraryOpen);
  const setLibraryData     = useStore((s) => s.setLibraryData);
  const setLibraryOpen     = useStore((s) => s.setLibraryOpen);
  const addLibraryFile     = useStore((s) => s.addLibraryFile);
  const updateLibraryFile  = useStore((s) => s.updateLibraryFile);
  const panelFocus         = useStore((s) => s.panelFocus as PanelFocus);
  const setPanelFocus      = useStore((s) => s.setPanelFocus);

  const pendingChatMessage    = useStore((s) => s.pendingChatMessage);
  const setPendingChatMessage = useStore((s) => s.setPendingChatMessage);
  const pendingCardSubmit     = useStore((s) => s.pendingCardSubmit);
  const setPendingCardSubmit  = useStore((s) => s.setPendingCardSubmit);

  const { launchWizard } = useDocumentHandlers();

  // Auto-fill input when a node context menu sends a message
  useEffect(() => {
    if (!pendingChatMessage) return;
    setInput(pendingChatMessage);
    setPendingChatMessage(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [pendingChatMessage]);

  // Questionnaire card submit — merge card answers with any typed text and auto-submit
  useEffect(() => {
    if (!pendingCardSubmit) return;
    setPendingCardSubmit(null);
    const combined = [pendingCardSubmit, input.trim()].filter(Boolean).join("\n\n");
    setInput("");
    void doSubmit(combined);
  }, [pendingCardSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load library whenever the project changes
  useEffect(() => {
    if (!version?.id) return;
    getLibrary(version.id)
      .then((data) => setLibraryData(data))
      .catch(() => { /* no library yet is fine */ });
  }, [version?.id]);

  const [input, setInput]             = useState("");
  const [thinking, setThinking]       = useState(false);
  const [dragOver, setDragOver]       = useState(false);
  const [plusOpen, setPlusOpen]       = useState(false);
  const [disambig, setDisambig]       = useState<DisambigState | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const pendingFileHandler = useRef<((files: File[]) => void) | null>(null);
  const composerRef        = useRef<HTMLDivElement>(null);
  const bottomRef          = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges.length, thinking]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Close [+] menu on outside click
  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setPlusOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  // ── Shared destination handlers ───────────────────────────────────────────

  // Drop on chat → attachment chip (staged for submit, not yet in library)
  function parkToLibrary(files: File[]) {
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ id: `lib_${Date.now()}_${f.name}`, name: f.name, file: f })),
    ]);
  }

  // Library takeover "Add" button → immediately add to library + upload content
  function handleAddFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const cls = classifyFile(file.name);
    if (cls === "table" || cls === "spreadsheet") {
      setLibraryOpen(false);
      void launchWizard(file);
      return;
    }
    const libFile: LibraryFile = {
      id: `lib_${Date.now()}_${file.name}`,
      name: file.name,
      type: ext,
      tier: "local",
      folderPath: "",
      updatedAt: new Date().toISOString(),
      size: file.size,
      selectedForContext: true,
    };
    addLibraryFile(libFile);
    const merged = [...libraryFiles, libFile];
    if (version?.id) {
      void putLibrary(version.id, { files: merged, folders: libraryFolders });
      void uploadLibraryContent(version.id, libFile.id, file).then(({ contentPath }) => {
        updateLibraryFile(libFile.id, { contentPath });
        void putLibrary(version.id!, {
          files: merged.map((f) => f.id === libFile.id ? { ...f, contentPath } : f),
          folders: libraryFolders,
        });
      });
    }
  }

  // ── File picker (for [+] menu) ────────────────────────────────────────────

  function pickFile(accept: string, multiple: boolean, handler: (files: File[]) => void) {
    const el = fileInputRef.current;
    if (!el) return;
    el.accept = accept;
    el.multiple = multiple;
    el.value = "";
    pendingFileHandler.current = handler;
    el.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0 && pendingFileHandler.current) {
      pendingFileHandler.current(files);
    }
    pendingFileHandler.current = null;
  }

  // ── [+] Menu activation ───────────────────────────────────────────────────

  function activateMenuItem(def: MenuItemDef) {
    setPlusOpen(false);
    pickFile(def.accept, def.multiple, (files) => {
      if (def.route === "wizard") {
        if (files[0]) void launchWizard(files[0]);
      } else {
        // library and plan both park to Library (plan stub = same destination)
        parkToLibrary(files);
      }
    });
  }

  const visibleItems = MENU_ITEM_DEFS.filter((d) => d.visible(activePlan));

  // ── Chat submit ───────────────────────────────────────────────────────────

  async function doSubmit(overrideText?: string) {
    const text = overrideText ?? input.trim();
    if ((!text && attachments.length === 0) || isLoading || thinking || !version) return;

    if (!overrideText) setInput("");
    const pendingAttachments = [...attachments];
    setAttachments([]);

    // Flush staged files to library
    if (pendingAttachments.length > 0 && version?.id) {
      const newLibFiles: LibraryFile[] = pendingAttachments.map((att) => ({
        id: att.id,
        name: att.name,
        type: att.name.split(".").pop()?.toLowerCase() ?? "",
        tier: "local",
        folderPath: "",
        updatedAt: new Date().toISOString(),
        size: att.file?.size,
        selectedForContext: true,
      }));
      for (const lf of newLibFiles) addLibraryFile(lf);
      const merged = [...libraryFiles, ...newLibFiles];
      void putLibrary(version.id, { files: merged, folders: libraryFolders });
      for (const att of pendingAttachments) {
        if (!att.file) continue;
        void uploadLibraryContent(version.id, att.id, att.file).then(({ contentPath }) => {
          updateLibraryFile(att.id, { contentPath });
        });
      }
    }

    if (!text) return;

    const ts = new Date().toISOString();
    const userExchange: Exchange = {
      id: `ex_u_${Date.now()}`,
      role: "user",
      text,
      status: "success",
      startedAt: ts,
    };
    appendExchanges([userExchange]);
    setThinking(true);
    setLoading(true);

    try {
      const selectedForContext = libraryFiles.filter((f) => f.selectedForContext);
      const result = await chat(version.id!, text, llmModel, [...exchanges, userExchange], version, selectedForContext.length > 0 ? selectedForContext : undefined);
      appendExchanges([result.exchange]);
      if (result.version) mergeServerVersion(result.version);
      if (result.wizard) openWizard(result.wizard);
    } catch (err) {
      appendExchanges([{
        id: `ex_err_${Date.now()}`,
        role: "assistant",
        text: `Error: ${(err as Error).message}`,
        status: "error",
        startedAt: new Date().toISOString(),
      }]);
    } finally {
      setThinking(false);
      setLoading(false);
    }
  }

  // ── Drop handlers (Route A — type-based) ─────────────────────────────────

  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function handleDragLeave(e: React.DragEvent) {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) {
      const cls = classifyFile(f.name);
      if (cls === "table" || cls === "spreadsheet") {
        setDisambig({ file: f }); // ambiguous on context — ask
        return;
      }
      parkToLibrary([f]);
    }
  }

  const canSubmit = (!!input.trim() || attachments.length > 0) && !isLoading && !thinking && !!version;

  return (
    <div
      className={`context-panel${dragOver ? " context-panel--drag" : ""}`}
      style={style}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drop overlay */}
      {dragOver && (
        <div className="drop-overlay">
          <IconCloudUpload size={28} />
          <span className="drop-overlay-label">Drop File</span>
          <span className="drop-overlay-sub">tables → wizard · docs → chat context</span>
        </div>
      )}

      {/* Disambiguation overlay */}
      {disambig && (
        <div className="cp-disambig-overlay">
          <div className="cp-disambig-box">
            <div className="cp-disambig-filename">{disambig.file.name}</div>
            <div className="cp-disambig-question">How should this file be used?</div>
            <div className="cp-disambig-btns">
              <button
                className="cp-disambig-btn cp-disambig-btn--primary"
                onClick={() => { void launchWizard(disambig.file); setDisambig(null); }}
              >
                Add as table → wizard
              </button>
              <button
                className="cp-disambig-btn"
                onClick={() => { parkToLibrary([disambig.file]); setDisambig(null); }}
              >
                Add to Library
              </button>
            </div>
            <button className="cp-disambig-cancel" onClick={() => setDisambig(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Library mode: full takeover of the context column */}
      {libraryOpen ? (
        <LibraryTakeover onAddFile={handleAddFile} />
      ) : (
        <>
          {/* Library shelf — pinned above conversation */}
          <LibraryShelf />

          {/* Header */}
          <div className="cp-header">
            <IconMessage size={13} style={{ color: "var(--blue-txt)", flexShrink: 0 }} />
            <span>Context</span>
            {contextFiles.length > 0 && (
              <span className="cp-file-count">
                {contextFiles.length} file{contextFiles.length !== 1 ? "s" : ""}
              </span>
            )}
            <div className="panel-max-btns">
              {panelFocus === "context" ? (
                <button className="panel-max-btn panel-max-btn--active" onClick={() => setPanelFocus("none")} title="Restore">
                  <IconArrowsMinimize size={13} />
                </button>
              ) : (
                <>
                  <button className="panel-max-btn" onClick={() => setPanelFocus("context-min")} title="Minimize">
                    <IconMinus size={11} />
                  </button>
                  <button className="panel-max-btn" onClick={() => setPanelFocus("context")} title="Maximize">
                    <IconArrowsMaximize size={11} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Persistent context files */}
          {contextFiles.length > 0 && (
            <div className="cp-files">
              {contextFiles.map((f) => (
                <div key={f.name} className="cp-file-chip">{f.name}</div>
              ))}
            </div>
          )}

          {/* Exchange thread */}
          <div className="cp-exchanges">
            {exchanges.length === 0 && (
              <div className="cp-empty">
                <span>No conversation yet.</span>
                <span>Describe what you want to build.</span>
              </div>
            )}
            {exchanges.map((ex) => (
              <ExchangeBubble key={ex.id} exchange={ex} />
            ))}
            {thinking && (
              <div className="exchange exchange--assistant">
                <div className="ex-assistant-msg">
                  <div className="ex-text cp-thinking">Thinking…</div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="cp-composer-wrap">
            <div className="cp-composer" ref={composerRef}>
              {plusOpen && (
                <div className="cp-plus-menu">
                  {visibleItems.map((def) => (
                    <button
                      key={def.id}
                      className="cp-plus-menu-item"
                      onClick={() => activateMenuItem(def)}
                    >
                      {def.getLabel(activePlan)}
                    </button>
                  ))}
                </div>
              )}
              {attachments.length > 0 && (
                <div className="cp-attachments">
                  {attachments.map((a) => (
                    <div key={a.id} className="cp-attach-chip">
                      <span className="cp-attach-name">{a.name}</span>
                      <button
                        className="cp-attach-remove"
                        onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      >
                        <IconX size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="cp-textarea-grow"
                placeholder={`Message ${PLAN_LABELS[activePlan]} plan…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void doSubmit();
                  }
                }}
                disabled={isLoading || thinking || !version}
                rows={1}
              />
              <div className="cp-composer-toolbar">
                <button
                  className="cp-plus-btn"
                  type="button"
                  title="Add file or table"
                  onClick={() => setPlusOpen((v) => !v)}
                >
                  <IconPlus size={13} />
                </button>
                <select
                  className="sel cp-model-sel"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                >
                  {LLM_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
                <button
                  className="cp-send-btn-new"
                  type="button"
                  title="Send"
                  disabled={!canSubmit}
                  onClick={() => void doSubmit()}
                >
                  <IconArrowUp size={14} />
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ExchangeBubble({ exchange }: { exchange: Exchange }) {
  const isUser = exchange.role === "user";
  return (
    <div className={`exchange exchange--${exchange.role}`}>
      {isUser ? (
        <div className="ex-user-msg">{exchange.text}</div>
      ) : (
        <div className="ex-assistant-msg">
          <div className="ex-text">{exchange.text}</div>
          {exchange.card && <CardPlayer card={exchange.card} />}
          {exchange.proposal && <ProposalCard proposal={exchange.proposal} />}
          {exchange.llmModel && (
            <div className="ex-meta">{exchange.llmModel} · {exchange.responseTimeMs}ms</div>
          )}
        </div>
      )}
    </div>
  );
}
