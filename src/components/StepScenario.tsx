"use client";

import {
  DemoConfig,
  INTEGRATION_TYPES,
  IntegrationType,
} from "@/lib/types";
import { SCENARIOS, getScenario } from "@/lib/scenarios";

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-soft)",
  marginBottom: 7,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid var(--edge)",
  background: "#fff",
  fontSize: 13,
  color: "var(--text)",
  fontFamily: "var(--mono)",
};

function pill(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    fontSize: 13,
    cursor: "pointer",
    border: active ? "1px solid var(--navy)" : "1px solid var(--edge)",
    background: active ? "var(--accent)" : "#fff",
    color: "var(--navy)",
    fontWeight: active ? 600 : 400,
    textAlign: "left",
  };
}

export default function StepScenario({
  config,
  onChange,
  onScenarioChange,
  payloadError,
  onBack,
  onRun,
  runLabel,
}: {
  config: DemoConfig;
  onChange: (patch: Partial<DemoConfig>) => void;
  onScenarioChange: (id: string) => void;
  payloadError: string | null;
  onBack: () => void;
  onRun: () => void;
  runLabel: string;
}) {
  const scenario = getScenario(config.scenarioId);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>
        Choose a scenario
      </h1>
      <p style={{ margin: "0 0 28px", color: "var(--text-soft)", fontSize: 14 }}>
        Pick what to demonstrate and how the checkout should render.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* Left column: scenario + integration */}
        <div>
          <div style={{ marginBottom: 22 }}>
            <label style={label} htmlFor="scenario">Payment scenario</label>
            <select id="scenario" value={config.scenarioId}
              onChange={(e) => onScenarioChange(e.target.value)}
              style={{ ...input, cursor: "pointer", fontFamily: "var(--sans)" }}>
              {SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.ready ? "" : " (preview)"}</option>
              ))}
            </select>
            <p style={{ margin: "7px 0 0", fontSize: 12, color: "var(--text-soft)", lineHeight: 1.4 }}>
              {scenario.blurb}
            </p>
            {scenario.fields.map((f) => (
              <div key={f.key} style={{ marginTop: 12 }}>
                <label style={{ ...label, textTransform: "none", letterSpacing: 0 }}>{f.label}</label>
                <input style={input} value={config.scenarioValues[f.key] ?? ""}
                  onChange={(e) => onChange({ scenarioValues: { ...config.scenarioValues, [f.key]: e.target.value } })}
                  placeholder={f.placeholder} autoComplete="off" spellCheck={false} />
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 22 }}>
            <span style={label}>How to render checkout</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {(Object.keys(INTEGRATION_TYPES) as IntegrationType[]).map((it) => (
                <button key={it} onClick={() => onChange({ integrationType: it })}
                  style={pill(config.integrationType === it)}>
                  {INTEGRATION_TYPES[it]}
                </button>
              ))}
            </div>
          </div>

          {config.integrationType === "sdk" && (
            <div style={{ marginBottom: 22 }}>
              <span style={label}>When to fetch methods</span>
              <div style={{ display: "flex", gap: 0 }}>
                {(["methods-first", "intent-first"] as const).map((val, i) => (
                  <button key={val} onClick={() => onChange({ methodTiming: val })}
                    style={{
                      flex: 1, padding: "10px", fontSize: 12.5, cursor: "pointer",
                      border: "1px solid var(--edge-strong)", borderLeft: i === 1 ? "none" : "1px solid var(--edge-strong)",
                      background: config.methodTiming === val ? "var(--navy)" : "#fff",
                      color: config.methodTiming === val ? "#fff" : "var(--text-soft)",
                      fontWeight: config.methodTiming === val ? 600 : 400,
                    }}>
                    {val === "methods-first" ? "Methods first" : "Intent first"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: optional fields + payload */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={label} htmlFor="flow">Flow ID (optional)</label>
            <input id="flow" style={input} value={config.flowId}
              onChange={(e) => onChange({ flowId: e.target.value })}
              placeholder="added to payload as flow_id" autoComplete="off" spellCheck={false} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={label} htmlFor="wh">Webhook URL (optional)</label>
            <input id="wh" style={input} value={config.webhookUrl}
              onChange={(e) => onChange({ webhookUrl: e.target.value })}
              placeholder="https://webhook.site/your-id" autoComplete="off" spellCheck={false} />
          </div>

          <details style={{ marginBottom: 16, border: "1px solid var(--edge)", padding: "10px 12px" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--navy)" }}>
              Redirect URLs (optional — default to built-in result page)
            </summary>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["successUrl", "Successful"],
                ["failUrl", "Failed"],
                ["pendingUrl", "Pending external action"],
                ["timeExpiredUrl", "Time expired"],
                ["closedUrl", "Closed"],
                ["backUrl", "Back"],
              ] as const).map(([key, lbl]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, color: "var(--text-soft)", display: "block", marginBottom: 4 }}>{lbl}</label>
                  <input style={input} value={config[key]}
                    onChange={(e) => onChange({ [key]: e.target.value })}
                    placeholder="https://…" autoComplete="off" spellCheck={false} />
                </div>
              ))}
            </div>
          </details>

          <div>
            <label style={label} htmlFor="payload">Intent payload (JSON)</label>
            <textarea id="payload" value={config.intentPayload}
              onChange={(e) => onChange({ intentPayload: e.target.value })}
              spellCheck={false} rows={12}
              style={{ ...input, resize: "vertical", fontSize: 12, lineHeight: 1.5 }} />
            {payloadError ? (
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--bad)" }}>{payloadError}</p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-soft)", lineHeight: 1.4 }}>
                The exact body sent to create the intent. Edit freely.
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 32, maxWidth: 420 }}>
        <button onClick={onBack}
          style={{ padding: "13px 22px", fontSize: 14, fontWeight: 600, border: "1px solid var(--edge-strong)", background: "#fff", color: "var(--navy)", cursor: "pointer" }}>
          Back
        </button>
        <button onClick={onRun} disabled={!!payloadError}
          style={{ flex: 1, padding: "13px", fontSize: 14, fontWeight: 600, border: "1px solid var(--navy)", background: payloadError ? "var(--surface)" : "var(--navy)", color: payloadError ? "var(--text-soft)" : "#fff", cursor: payloadError ? "not-allowed" : "pointer" }}>
          {runLabel}
        </button>
      </div>
    </div>
  );
}
