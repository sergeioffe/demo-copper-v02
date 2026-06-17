import React, { useRef, useState, useEffect } from "react";
import { IconArrowUp, IconPencil, IconTrash, IconCopy } from "@tabler/icons-react";
import type { DataPlanEntity } from "@copper/contracts";

interface Props {
  nodeId: string;
  entity: DataPlanEntity;
  x: number;
  y: number;
  onSend: (msg: string) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDismiss: () => void;
}

export default function NodeContextMenu({ nodeId, entity, x, y, onSend, onRename, onDelete, onDuplicate, onDismiss }: Props) {
  const entityName = (entity as { name?: string }).name ?? nodeId;

  const [input, setInput]       = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(entityName);

  const rootRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (renaming) renameRef.current?.select(); }, [renaming]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onDismiss();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onDismiss]);

  function send() {
    const t = input.trim();
    if (!t) return;
    onSend(`${t} [referring to ${entity.type} "${entityName}" (id: ${nodeId})]`);
    onDismiss();
  }

  function confirmRename() {
    const t = renameVal.trim();
    if (t && t !== entityName) onRename(t);
    setRenaming(false);
  }

  return (
    <div
      ref={rootRef}
      className="ncm"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="ncm-head">
        <span className="ncm-type">{entity.type}</span>
        {renaming ? (
          <input
            ref={renameRef}
            className="ncm-rename-inp"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmRename(); }
              if (e.key === "Escape") { setRenaming(false); setRenameVal(entityName); }
            }}
            onBlur={confirmRename}
          />
        ) : (
          <span className="ncm-name">{entityName}</span>
        )}
      </div>

      {/* Chat input */}
      <div className="ncm-row">
        <input
          ref={inputRef}
          className="ncm-input"
          placeholder={`Instruct about ${entityName}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); send(); }
            if (e.key === "Escape") onDismiss();
          }}
        />
        <button className="ncm-send" onClick={send} disabled={!input.trim()} title="Send to chat">
          <IconArrowUp size={12} />
        </button>
      </div>

      {/* Action buttons */}
      <div className="ncm-actions">
        <button
          className="ncm-act"
          onClick={() => { setRenaming(true); setRenameVal(entityName); }}
          title="Rename"
        >
          <IconPencil size={11} /> Rename
        </button>
        <button
          className="ncm-act ncm-act--dup"
          onClick={() => { onDuplicate(); onDismiss(); }}
          title="Duplicate"
        >
          <IconCopy size={11} /> Duplicate
        </button>
        <button
          className="ncm-act ncm-act--del"
          onClick={() => { onDelete(); onDismiss(); }}
          title="Delete"
        >
          <IconTrash size={11} /> Delete
        </button>
      </div>
    </div>
  );
}
