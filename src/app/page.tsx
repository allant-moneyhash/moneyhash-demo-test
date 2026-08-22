"use client";

import { useMemo, useState } from "react";
import { DemoConfig } from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/defaults";
import { useCheckout } from "@/lib/useCheckout";
import ConfigPanel from "@/components/ConfigPanel";
import Inspector from "@/components/Inspector";

export default function Home() {
  const [config, setConfig] = useState<DemoConfig>(DEFAULT_CONFIG);
  const { log, busy, outcome, start, reset } = useCheckout();

  const payloadError = useMemo(() => {
    try {
      JSON.parse(config.intentPayload);
      return null;
    } catch (e) {
      return e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON";
    }
  }, [config.intentPayload]);

  function patch(p: Partial<DemoConfig>) {
    setConfig((c) => ({ ...c, ...p }));
  }

  const outcomeMeta = {
    success: { text: "Payment successful", color: "var(--ok)" },
    failed: { text: "Payment failed", color: "var(--bad)" },
    cancelled: { text: "Payment cancelled", color: "var(--warn)" },
    pending: { text: "Pending…", color: "var(--warn)" },
  } as const;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr 420px",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {/* LEFT: config */}
      <aside
        style={{
          borderRight: "1px solid var(--paper-edge)",
          overflowY: "auto",
          padding: "18px 18px 40px",
          background: "var(--paper)",
        }}
      >
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            MoneyHash Demo
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--text-soft)",
              lineHeight: 1.4,
            }}
          >
            Configure a checkout and watch every call it makes.
          </p>
        </div>
        <ConfigPanel
          config={config}
          onChange={patch}
          onStart={() => start(config)}
          busy={busy}
          payloadError={payloadError}
        />
      </aside>

      {/* MIDDLE: checkout stage */}
      <main
        style={{
          overflowY: "auto",
          padding: "28px 32px",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Checkout</h2>
          {(log.length > 0 || outcome) && (
            <button
              onClick={reset}
              style={{
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 7,
                border: "1px solid var(--paper-edge)",
                background: "#fff",
                cursor: "pointer",
                color: "var(--text-soft)",
              }}
            >
              Reset
            </button>
          )}
        </div>

        {outcome && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 9,
              marginBottom: 18,
              background: "#fff",
              border: `1px solid ${outcomeMeta[outcome].color}`,
              color: outcomeMeta[outcome].color,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {outcomeMeta[outcome].text}
          </div>
        )}

        {/* The SDK / embed renders its form into this container. */}
        <div
          id="mh-embed"
          style={{
            flex: 1,
            minHeight: 360,
            borderRadius: 12,
            border: "1px dashed var(--paper-edge)",
            display: log.length === 0 ? "flex" : "block",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
          }}
        >
          {log.length === 0 && (
            <p
              style={{
                color: "var(--text-soft)",
                fontSize: 13,
                textAlign: "center",
                maxWidth: 320,
                lineHeight: 1.5,
              }}
            >
              The checkout form will appear here once you start a payment.
            </p>
          )}
        </div>
      </main>

      {/* RIGHT: inspector */}
      <Inspector entries={log} />
    </div>
  );
}
