"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCheckout } from "@/lib/useCheckout";
import { getScenario } from "@/lib/scenarios";
import Header from "@/components/Header";
import StepSetup from "@/components/StepSetup";
import StepScenario from "@/components/StepScenario";
import Inspector from "@/components/Inspector";
import NativePayButtons from "@/components/NativePayButtons";

export default function CheckoutWizard() {
  const router = useRouter();
  const { cart, currency, config, setConfig, step, setStep } = useStore();
  const {
    log, busy, outcome, phase, methods, selectedMethodId,
    setStage, loadMethods, payNow, startPayment, selectMethod, reset, clearLog,
    expressMethods, submitNativeReceipt, validateApplePay,
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
      const total = cart.reduce((s, i) => s + (i.product.price[currency] ?? 0) * i.quantity, 0);
      const base = { amount: total, amount_currency: currency, product_items: items, form_only: true };
      return getScenario(scenarioId).buildPayload(base, values);
    },
    [cart, currency],
  );

  // Seed payload when entering the scenario step, unless hand-edited.
  useEffect(() => {
    if (step === 3 && !payloadEdited) {
      setConfig({ intentPayload: JSON.stringify(buildFullPayload(config.scenarioId, config.scenarioValues), null, 2) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buildFullPayload, payloadEdited]);

  function handleScenarioChange(scenarioId: string) {
    setPayloadEdited(false);
    setConfig({
      scenarioId,
      intentPayload: JSON.stringify(buildFullPayload(scenarioId, config.scenarioValues), null, 2),
    });
  }

  const payloadError = useMemo(() => {
    try { JSON.parse(config.intentPayload); return null; }
    catch (e) { return e instanceof Error ? `Invalid JSON: ${e.message}` : "Invalid JSON"; }
  }, [config.intentPayload]);

  function patch(p: Partial<typeof config>) {
    if (p.intentPayload !== undefined) setPayloadEdited(true);
    setConfig(p);
  }

  const isMethodsFirstSdk =
    config.integrationType === "sdk" && config.methodTiming === "methods-first";
  const runLabel = isMethodsFirstSdk ? "Load payment methods" : "Start payment";

  function handleRun() {
    setStep(4);
    if (isMethodsFirstSdk) loadMethods(config);
    else startPayment(config);
  }

  const outcomeMeta = {
    success: { text: "Payment successful", color: "var(--ok)" },
    failed: { text: "Payment failed", color: "var(--bad)" },
    cancelled: { text: "Payment cancelled", color: "var(--warn)" },
    pending: { text: "Pending…", color: "var(--warn)" },
  } as const;

  const total = cart.reduce((s, i) => s + (i.product.price[currency] ?? 0) * i.quantity, 0);
  const showPayButton = isMethodsFirstSdk && phase === "methods-shown" && !!selectedMethodId;

  function goStep(n: number) {
    if (n === 1) { router.push("/"); return; }
    setStep(n);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header step={step} onStepClick={goStep} />

      {/* STEP 2: Setup */}
      {step === 2 && (
        <StepSetup
          config={config}
          onChange={patch}
          onBack={() => router.push("/")}
          onNext={() => setStep(3)}
        />
      )}

      {/* STEP 3: Scenario */}
      {step === 3 && (
        <StepScenario
          config={config}
          onChange={patch}
          onScenarioChange={handleScenarioChange}
          payloadError={payloadError}
          onBack={() => setStep(2)}
          onRun={handleRun}
          runLabel={runLabel}
        />
      )}

      {/* STEP 4: Run — split screen */}
      {step === 4 && (
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 440px",
            minHeight: 0,
          }}
        >
          <main style={{ overflowY: "auto", padding: "28px 36px", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--navy)" }}>
                  {getScenario(config.scenarioId).name}
                </h2>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  {cart.length} item(s) · {currency} {total.toLocaleString()}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { reset(); setStep(3); }}
                  style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--edge-strong)", background: "#fff", cursor: "pointer", color: "var(--navy)" }}>
                  Change scenario
                </button>
                <button onClick={() => { reset(); handleRun(); }}
                  style={{ fontSize: 12, padding: "8px 14px", border: "1px solid var(--edge-strong)", background: "#fff", cursor: "pointer", color: "var(--navy)" }}>
                  Restart
                </button>
              </div>
            </div>

            {getScenario(config.scenarioId).hint && (
              <div style={{ padding: "11px 14px", marginBottom: 18, background: "var(--accent)", border: "1px solid var(--accent-line)", color: "var(--navy)", fontSize: 12.5, lineHeight: 1.4 }}>
                <strong>{getScenario(config.scenarioId).name}:</strong> {getScenario(config.scenarioId).hint}
              </div>
            )}

            {outcome && (
              <div style={{ padding: "12px 16px", marginBottom: 18, background: "#fff", border: `1px solid ${outcomeMeta[outcome].color}`, color: outcomeMeta[outcome].color, fontWeight: 600, fontSize: 14 }}>
                {outcomeMeta[outcome].text}
              </div>
            )}

            {phase === "methods-shown" && (expressMethods.length > 0 || methods.length > 0) && (
              <>
                {expressMethods.length > 0 && (
                  <NativePayButtons
                    express={expressMethods}
                    environment={config.environment}
                    onGoogleToken={(receipt) => submitNativeReceipt(config, "GOOGLE_PAY", receipt)}
                    onAppleReceipt={(receipt) => submitNativeReceipt(config, "APPLE_PAY", receipt)}
                    onValidateApple={(methodId, url) => validateApplePay(config, methodId, url)}
                  />
                )}
              </>
            )}

            {phase === "methods-shown" && methods.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--navy)" }}>
                  Choose a payment method
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {methods.map((m) => {
                    const active = selectedMethodId === m.id;
                    return (
                      <button key={m.id} onClick={() => selectMethod(m)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
                          border: active ? "2px solid var(--navy)" : "1px solid var(--edge)",
                          background: active ? "var(--accent)" : "#fff", cursor: "pointer",
                          textAlign: "left", fontSize: 14, fontWeight: 500, color: "var(--navy)",
                        }}>
                        {m.icons && m.icons[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.icons[0]} alt="" style={{ height: 22, width: "auto" }} />
                        )}
                        {m.title || m.id}
                      </button>
                    );
                  })}
                </div>
                {showPayButton && (
                  <button onClick={() => payNow(config)} disabled={busy}
                    style={{ marginTop: 14, width: "100%", padding: "13px", fontSize: 14, fontWeight: 600, border: "1px solid var(--navy)", background: busy ? "var(--surface)" : "var(--navy)", color: busy ? "var(--text-soft)" : "#fff", cursor: busy ? "not-allowed" : "pointer" }}>
                    {busy ? "Working…" : `Pay with ${selectedMethodId}`}
                  </button>
                )}
              </div>
            )}

            {phase === "methods-shown" && methods.length === 0 && (
              <div style={{ padding: "12px 16px", marginBottom: 18, border: "1px solid var(--warn)", color: "var(--warn)", fontSize: 13 }}>
                No payment methods came back for this currency/account. Check that providers are connected in your sandbox for this currency.
              </div>
            )}

            <IsolatedStage setStage={setStage} empty={log.length === 0} />
          </main>

          <Inspector entries={log} onClear={clearLog} />
        </div>
      )}
    </div>
  );
}

function IsolatedStage({ setStage, empty }: { setStage: (el: HTMLElement | null) => void; empty: boolean; }) {
  return (
    <div style={{ minHeight: 360, border: "1px solid var(--edge)", padding: 20, position: "relative" }}>
      {empty && (
        <p style={{ color: "var(--text-soft)", fontSize: 13, textAlign: "center", maxWidth: 340, lineHeight: 1.5, margin: "80px auto" }}>
          The checkout form appears here as the payment runs.
        </p>
      )}
      <div ref={setStage} suppressHydrationWarning style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
