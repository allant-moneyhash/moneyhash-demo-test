"use client";

import { DemoConfig, ENVIRONMENTS, INTEGRATION_TYPES, Environment, IntegrationType, API_VERSIONS, ApiVersion, buildBaseURL } from "@/lib/types";
import { QUICK_CURRENCIES } from "@/lib/defaults";

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-soft)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--paper-edge)",
  borderRadius: 8,
  background: "#fff",
  fontSize: 13,
  color: "var(--text)",
  fontFamily: "var(--mono)",
};

export default function ConfigPanel({
  config,
  onChange,
  onStart,
  busy,
  payloadError,
}: {
  config: DemoConfig;
  onChange: (patch: Partial<DemoConfig>) => void;
  onStart: () => void;
  busy: boolean;
  payloadError: string | null;
}) {
  const canStart =
    !!config.publicApiKey &&
    !!config.secretApiKey &&
    !payloadError &&
    !busy;

  // Quick currency picker rewrites amount_currency inside the JSON payload.
  function setCurrency(cur: string) {
    try {
      const parsed = JSON.parse(config.intentPayload);
      parsed.amount_currency = cur;
      onChange({ intentPayload: JSON.stringify(parsed, null, 2) });
    } catch {
      // If JSON is currently invalid, leave it — user is mid-edit.
    }
  }

  let currentCurrency = "";
  try {
    currentCurrency = JSON.parse(config.intentPayload).amount_currency || "";
  } catch {
    /* ignore */
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Environment */}
      <div>
        <label style={labelStyle}>Environment</label>
        <div style={{ display: "flex", gap: 8 }}>
          {(Object.keys(ENVIRONMENTS) as Environment[]).map((env) => {
            const active = config.environment === env;
            return (
              <button
                key={env}
                onClick={() => onChange({ environment: env })}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  fontSize: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: active
                    ? "1px solid var(--signal)"
                    : "1px solid var(--paper-edge)",
                  background: active ? "rgba(18,181,176,0.08)" : "#fff",
                  color: active ? "var(--signal-deep)" : "var(--text-soft)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {env === "sandbox" ? "Sandbox" : "Production"}
              </button>
            );
          })}
        </div>
        {config.environment === "production" && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 11.5,
              color: "var(--bad)",
              lineHeight: 1.4,
            }}
          >
            Production moves real money. Use sandbox for demos and testing.
          </p>
        )}
      </div>

      {/* API version */}
      <div>
        <label style={labelStyle} htmlFor="ver">
          API version
        </label>
        <select
          id="ver"
          value={config.apiVersion}
          onChange={(e) =>
            onChange({ apiVersion: e.target.value as ApiVersion })
          }
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          {API_VERSIONS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <p
          className="mono"
          style={{
            margin: "6px 0 0",
            fontSize: 10.5,
            color: "var(--text-soft)",
            wordBreak: "break-all",
          }}
        >
          {buildBaseURL(config.environment, config.apiVersion)}
        </p>
      </div>

      {/* Keys */}
      <div>
        <label style={labelStyle} htmlFor="pk">
          Public API key
        </label>
        <input
          id="pk"
          style={inputStyle}
          value={config.publicApiKey}
          onChange={(e) => onChange({ publicApiKey: e.target.value })}
          placeholder="public.xxxx.xxxx"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div>
        <label style={labelStyle} htmlFor="sk">
          Secret API key
        </label>
        <input
          id="sk"
          style={inputStyle}
          value={config.secretApiKey}
          onChange={(e) => onChange({ secretApiKey: e.target.value })}
          placeholder="xxxx.xxxx"
          autoComplete="off"
          spellCheck={false}
          type="password"
        />
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 11,
            color: "var(--text-soft)",
            lineHeight: 1.4,
          }}
        >
          Used once per request through our own relay to create the intent. Never
          stored, never shared in a link.
        </p>
      </div>

      {/* Integration type */}
      <div>
        <label style={labelStyle}>How to render checkout</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(Object.keys(INTEGRATION_TYPES) as IntegrationType[]).map((it) => {
            const active = config.integrationType === it;
            return (
              <button
                key={it}
                onClick={() => onChange({ integrationType: it })}
                style={{
                  textAlign: "left",
                  padding: "9px 11px",
                  fontSize: 12.5,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: active
                    ? "1px solid var(--signal)"
                    : "1px solid var(--paper-edge)",
                  background: active ? "rgba(18,181,176,0.08)" : "#fff",
                  color: active ? "var(--signal-deep)" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {INTEGRATION_TYPES[it]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick currency */}
      <div>
        <label style={labelStyle}>Currency (quick set)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_CURRENCIES.map((cur) => {
            const active = currentCurrency === cur;
            return (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className="mono"
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  borderRadius: 6,
                  cursor: "pointer",
                  border: active
                    ? "1px solid var(--signal)"
                    : "1px solid var(--paper-edge)",
                  background: active ? "rgba(18,181,176,0.08)" : "#fff",
                  color: active ? "var(--signal-deep)" : "var(--text-soft)",
                }}
              >
                {cur}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payload editor */}
      <div>
        <label style={labelStyle} htmlFor="payload">
          Intent payload (JSON)
        </label>
        <textarea
          id="payload"
          value={config.intentPayload}
          onChange={(e) => onChange({ intentPayload: e.target.value })}
          spellCheck={false}
          rows={14}
          style={{
            ...inputStyle,
            resize: "vertical",
            lineHeight: 1.5,
            fontSize: 12,
          }}
        />
        {payloadError ? (
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--bad)" }}>
            {payloadError}
          </p>
        ) : (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 11,
              color: "var(--text-soft)",
              lineHeight: 1.4,
            }}
          >
            This is the exact body sent to create the intent. Add flow_id,
            billing_data, allow_tokenize_card, or anything else your scenario
            needs.
          </p>
        )}
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        style={{
          padding: "12px 16px",
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 9,
          border: "none",
          cursor: canStart ? "pointer" : "not-allowed",
          background: canStart ? "var(--signal)" : "var(--paper-edge)",
          color: canStart ? "#fff" : "var(--text-soft)",
        }}
      >
        {busy ? "Working…" : "Start payment"}
      </button>
    </div>
  );
}
