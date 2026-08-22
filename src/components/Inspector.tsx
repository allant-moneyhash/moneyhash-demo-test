"use client";

import { useState } from "react";
import { LogEntry, LogKind } from "@/lib/types";

const KIND_META: Record<LogKind, { label: string; color: string }> = {
  request: { label: "REQUEST", color: "var(--signal)" },
  response: { label: "RESPONSE", color: "var(--ok)" },
  "sdk-state": { label: "SDK STATE", color: "#9a86e0" },
  info: { label: "INFO", color: "var(--ink-dim)" },
  error: { label: "ERROR", color: "var(--bad)" },
};

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(true);
  const meta = KIND_META[entry.kind];
  const hasBody = !!entry.body;

  return (
    <div style={{ borderBottom: "1px solid var(--ink-line)" }}>
      <button
        onClick={() => hasBody && setOpen((o) => !o)}
        style={{
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "10px 14px",
          cursor: hasBody ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.08em",
            color: meta.color,
            border: `1px solid ${meta.color}`,
            borderRadius: 4,
            padding: "1px 6px",
            flexShrink: 0,
          }}
        >
          {meta.label}
        </span>
        <span
          style={{
            color: "var(--ink-text)",
            fontSize: 13,
            flex: 1,
            lineHeight: 1.3,
          }}
        >
          {entry.title}
        </span>
        {hasBody && (
          <span
            className="mono"
            style={{ color: "var(--ink-dim)", fontSize: 11, flexShrink: 0 }}
          >
            {open ? "−" : "+"}
          </span>
        )}
      </button>
      {hasBody && open && (
        <pre
          className="mono"
          style={{
            margin: 0,
            padding: "0 14px 12px 14px",
            color: "var(--ink-dim)",
            fontSize: 11.5,
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowX: "auto",
          }}
        >
          {entry.body}
        </pre>
      )}
    </div>
  );
}

export default function Inspector({ entries }: { entries: LogEntry[] }) {
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--ink-text)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--ink-line)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: entries.length ? "var(--signal)" : "var(--ink-dim)",
            boxShadow: entries.length
              ? "0 0 8px var(--signal)"
              : "none",
          }}
        />
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: "var(--ink-text)",
          }}
        >
          Inspector
        </h2>
        <span
          className="mono"
          style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-dim)" }}
        >
          {entries.length} {entries.length === 1 ? "event" : "events"}
        </span>
      </div>

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {entries.length === 0 ? (
          <div
            style={{
              padding: "28px 18px",
              color: "var(--ink-dim)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Nothing yet. Configure your keys and payload on the left, then start
            a payment. Every call to MoneyHash and every step the SDK takes will
            appear here.
          </div>
        ) : (
          entries.map((e) => <LogRow key={e.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
