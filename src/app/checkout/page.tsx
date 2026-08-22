"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCheckout } from "@/lib/useCheckout";
import { getScenario } from "@/lib/scenarios";
import ConfigPanel from "@/components/ConfigPanel";
import Inspector from "@/components/Inspector";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, currency, config, setConfig } = useStore();
  const { log, busy, outcome, start, reset } = useCheckout();
  const [payloadEdited, setPayloadEdited] = useState(false);

  // Build the base payload from the cart, then let the scenario shape it.
  const buildFullPayload = useMemo(() => {
    return (scenarioId: string, values: Record<string, string>) => {
      const items = cart.map((i) => ({
        name: i.product.name,
        description: i.product.description,
        quantity: i.quantity,
        amount: i.product.price[currency] ?? 0,
      }));
      const total = cart.reduce(
        (sum, i) => sum + (i.product.price[currency] ?? 0) * i.quantity,
        0,
      );
      const base = {
        amount: total,
        amount_currency: currency,
        product_items: items,
        form_only: true,
      };
      return getScenario(scenarioId).buildPayload(base, values);
    };
  }, [cart, currency]);

  // Seed the editable payload from cart + scenario when arriving (once),
  // unless the user has hand-edited it.
  useEffect(() => {
    if (!payloadEdited) {
      setConfig({
        intentPayload: JSON.stringify(
          buildFullPayload(config.scenarioId, config.scenarioValues),
          null,
          2,
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildFullPayload, payloadEdited]);

  // When the scenario changes, rewrite the payload (and reset the edited flag
  // so the new scenario's shape takes effect), but keep it overwritable after.
  function handleScenarioChange(scenarioId: string) {
    setPayloadEdited(false);
    setConfig({
      scenarioId,
      intentPayload: JSON.stringify(
        buildFullPayload(scenarioId, config.scenarioValues),
        null,
        2,
      ),
    });
  }

  const payloadError = useMemo(() => {
    try {
      JSON.parse(config.intentPayload);
      return null;
    } catch (e) {
      return e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON";
    }
  }, [config.intentPayload]);

  function patch(p: Partial<typeof config>) {
    if (p.intentPayload !== undefined) setPayloadEdited(true);
    setConfig(p);
  }

  const outcomeMeta = {
    success: { text: "Payment successful", color: "var(--ok)" },
    failed: { text: "Payment failed", color: "var(--bad)" },
    cancelled: { text: "Payment cancelled", color: "var(--warn)" },
    pending: { text: "Pending…", color: "var(--warn)" },
  } as const;

  const total = cart.reduce(
    (sum, i) => sum + (i.product.price[currency] ?? 0) * i.quantity,
    0,
  );

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
          <button
            onClick={() => router.push("/")}
            style={{
              fontSize: 12,
              background: "transparent",
              border: "none",
              color: "var(--signal-deep)",
              cursor: "pointer",
              padding: 0,
              marginBottom: 10,
            }}
          >
            ← Back to shop
          </button>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Checkout</h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--text-soft)",
              lineHeight: 1.4,
            }}
          >
            Configure your keys, then start the payment and watch each call.
          </p>
        </div>
        <ConfigPanel
          config={config}
          onChange={patch}
          onScenarioChange={handleScenarioChange}
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
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Order summary
            </h2>
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--text-soft)" }}
            >
              {cart.length} item(s) · {currency} {total.toLocaleString()}
            </span>
          </div>
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

        {getScenario(config.scenarioId).hint && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 9,
              marginBottom: 18,
              background: "rgba(18,181,176,0.06)",
              border: "1px solid rgba(18,181,176,0.25)",
              color: "var(--signal-deep)",
              fontSize: 12.5,
              lineHeight: 1.4,
            }}
          >
            <strong>{getScenario(config.scenarioId).name}:</strong>{" "}
            {getScenario(config.scenarioId).hint}
          </div>
        )}

        {cart.length === 0 && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 9,
              marginBottom: 18,
              border: "1px solid var(--warn)",
              color: "var(--warn)",
              fontSize: 13,
            }}
          >
            Your cart is empty. You can still test with the payload on the left,
            or go back to the shop to add items.
          </div>
        )}

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
              The checkout form will appear here once you start the payment.
            </p>
          )}
        </div>
      </main>

      {/* RIGHT: inspector */}
      <Inspector entries={log} />
    </div>
  );
}
