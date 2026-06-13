import React, { useRef, useEffect, useState } from "react";
import { useStore } from "../store.js";
import ProposalCard from "./ProposalCard.js";
import { CardPlayer } from "./cards/CardPlayer.js";
import { chat } from "../api.js";
import { IconMessage, IconArrowUp } from "@tabler/icons-react";
import type { Exchange } from "@copper/contracts";

export default function ContextPanel() {
  const version         = useStore((s) => s.version);
  const exchanges       = useStore((s) => s.version?.context.exchanges)    ?? [];
  const contextFiles    = useStore((s) => s.version?.context.contextFiles) ?? [];
  const activePlan      = useStore((s) => s.activePlan);
  const isLoading       = useStore((s) => s.isLoading);
  const llmModel        = useStore((s) => s.llmModel);
  const appendExchanges    = useStore((s) => s.appendExchanges);
  const mergeServerVersion = useStore((s) => s.mergeServerVersion);
  const setLoading         = useStore((s) => s.setLoading);

  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [exchanges.length, thinking]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || thinking || !version) return;

    setInput("");
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
      const result = await chat(version.id!, text, llmModel, [...exchanges, userExchange], version);
      appendExchanges([result.exchange]);
      // Merge server version (updated plans) while preserving client-side exchanges
      if (result.version) mergeServerVersion(result.version);
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

  return (
    <div className="context-panel">
      <div className="cp-header">
        <IconMessage size={13} />
        <span>Context</span>
        {contextFiles.length > 0 && (
          <span className="cp-file-count">{contextFiles.length} file{contextFiles.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {contextFiles.length > 0 && (
        <div className="cp-files">
          {contextFiles.map((f) => (
            <div key={f.name} className="cp-file-chip">{f.name}</div>
          ))}
        </div>
      )}

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

      <form className="cp-input-row" onSubmit={handleSubmit}>
        <textarea
          className="cp-textarea"
          rows={2}
          placeholder={`Message ${activePlan === "data" ? "data" : "media"} plan… (M3)`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={isLoading || thinking || !version}
        />
        <button
          className="cp-send-btn"
          type="submit"
          disabled={isLoading || thinking || !input.trim() || !version}
        >
          <IconArrowUp size={14} />
        </button>
      </form>
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
          {exchange.proposal && (
            <ProposalCard proposal={exchange.proposal} />
          )}
          {exchange.llmModel && (
            <div className="ex-meta">{exchange.llmModel} · {exchange.responseTimeMs}ms</div>
          )}
        </div>
      )}
    </div>
  );
}
