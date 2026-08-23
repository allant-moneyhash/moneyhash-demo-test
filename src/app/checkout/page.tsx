"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCheckout } from "@/lib/useCheckout";
import { getScenario } from "@/lib/scenarios";
import ConfigPanel from "@/components/ConfigPanel";
import Inspector from "@/components/Inspector";

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, currency, config, setConfig } = useStore();
  const {
    log,
    busy,
    outcome,
    phase,
    methods,
    selectedMethodId,
    setStage,
    loadMethods,
    payNow,
    startPayment,
    selectMethod,
    reset,
  } = useCheckout();
  const [payloadEdited, setPayloadEdited] = useState(false);

  const buildFullPayload = useCallback(
    (scenarioId: string, values: Record<string, string>) => {
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
    },
    [cart, currency],
  );

  // Seed the editable payload once on arrival, unless hand-edited.
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

  // Which primary action does the button trigger?
  // Methods-first + SDK: "Load payment methods" (then a Pay button appears).
  // Everything else: "Start payment".
  const isMethodsFirstSdk =
    config.integrationType === "sdk" && config.methodTiming === "methods-first";

  function handlePrimary() {
    if (isMethodsFirstSdk) {
      loadMethods(config);
    } else {
      startPayment(config);
    }
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

  const showPayButton =
    isMethodsFirstSdk && phase === "methods-shown" && !!selectedMethodId;

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
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Checkout{" "}
            <span
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "var(--signal-deep)",
                background: "rgba(18,181,176,0.1)",
                padding: "1px 6px",
                borderRadius: 5,
                verticalAlign: "middle",
              }}
            >
              v7
            </span>
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--text-soft)",
              lineHeight: 1.4,
            }}
          >
            Configure your keys, then run the payment and watch each call.
          </p>
        </div>
        <ConfigPanel
          config={config}
          onChange={patch}
          onScenarioChange={handleScenarioChange}
          onStart={handlePrimary}
          startLabel={isMethodsFirstSdk ? "Load payment methods" : "Start payment"}
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

        {/* Method selection (both orderings surface methods here) */}
        {phase === "methods-shown" && methods.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Choose a payment method
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {methods.map((m) => {
                const active = selectedMethodId === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => selectMethod(m.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      border: active
                        ? "2px solid var(--signal)"
                        : "1px solid var(--paper-edge)",
                      borderRadius: 10,
                      background: active ? "rgba(18,181,176,0.06)" : "#fff",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {m.icons && m.icons[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.icons[0]}
                        alt=""
                        style={{ height: 22, width: "auto" }}
                      />
                    )}
                    {m.title || m.id}
                  </button>
                );
              })}
            </div>

            {showPayButton && (
              <button
                onClick={() => payNow(config)}
                disabled={busy}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 9,
                  border: "none",
                  background: busy ? "var(--paper-edge)" : "var(--signal)",
                  color: busy ? "var(--text-soft)" : "#fff",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {busy ? "Working…" : `Pay with ${selectedMethodId}`}
              </button>
            )}
          </div>
        )}

        {phase === "methods-shown" && methods.length === 0 && (
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
            No payment methods came back for this currency/account. Check that
            providers are connected in your sandbox for this currency.
          </div>
        )}

        {/* ISOLATED stage: React renders this empty div ONCE and never touches
            its children. The SDK / iframe render into it via the ref. This is
            what prevents the removeChild crash. */}
        <IsolatedStage setStage={setStage} empty={log.length === 0} />
      </main>

      {/* RIGHT: inspector */}
      <Inspector entries={log} />
    </div>
  );
}

// A container React renders once and then leaves alone. We pass the node up via
// a ref callback; React never re-renders its children because they're never
// React children — they're added by the SDK outside React's tree.
function IsolatedStage({
  setStage,
  empty,
}: {
  setStage: (el: HTMLElement | null) => void;
  empty: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 360,
        borderRadius: 12,
        border: "1px dashed var(--paper-edge)",
        padding: 16,
        position: "relative",
      }}
    >
      {empty && (
        <p
          style={{
            color: "var(--text-soft)",
            fontSize: 13,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.5,
            margin: "80px auto",
          }}
        >
          The checkout form will appear here once you start the payment.
        </p>
      )}
      {/* The node the SDK/iframe fill. React owns only this empty div and never
          re-renders its inner content. */}
      <div
        ref={setStage}
        suppressHydrationWarning
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
