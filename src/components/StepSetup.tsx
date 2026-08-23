"use client";

import {
  DemoConfig,
  ENVIRONMENTS,
  Environment,
  API_VERSIONS,
  ApiVersion,
  buildBaseURL,
} from "@/lib/types";

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
  padding: "12px 13px",
  border: "1px solid var(--edge)",
  background: "#fff",
  fontSize: 13,
  color: "var(--text)",
  fontFamily: "var(--mono)",
};

export default function StepSetup({
  config,
  onChange,
  onBack,
  onNext,
}: {
  config: DemoConfig;
  onChange: (patch: Partial<DemoConfig>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue = !!config.publicApiKey && !!config.secretApiKey;

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>
        Connect your account
      </h1>
      <p style={{ margin: "0 0 32px", color: "var(--text-soft)", fontSize: 14, lineHeight: 1.5 }}>
        Enter your MoneyHash API keys. They&apos;re used per-request through our
        own relay and are never stored or shared in a link.
      </p>

      {/* Environment */}
      <div style={{ marginBottom: 22 }}>
        <span style={label}>Environment</span>
        <div style={{ display: "flex", gap: 0 }}>
          {(Object.keys(ENVIRONMENTS) as Environment[]).map((env) => {
            const active = config.environment === env;
            return (
              <button
                key={env}
                onClick={() => onChange({ environment: env })}
                style={{
                  flex: 1,
                  padding: "11px",
                  fontSize: 13,
                  cursor: "pointer",
                  border: "1px solid var(--edge-strong)",
                  borderLeft: env === "production" ? "none" : "1px solid var(--edge-strong)",
                  background: active ? "var(--navy)" : "#fff",
                  color: active ? "#fff" : "var(--text-soft)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {env === "sandbox" ? "Sandbox" : "Production"}
              </button>
            );
          })}
        </div>
        {config.environment === "production" && (
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--bad)" }}>
            Production moves real money. Use sandbox for demos.
          </p>
        )}
      </div>

      {/* API version */}
      <div style={{ marginBottom: 22 }}>
        <label style={label} htmlFor="ver">API version</label>
        <select
          id="ver"
          value={config.apiVersion}
          onChange={(e) => onChange({ apiVersion: e.target.value as ApiVersion })}
          style={{ ...input, cursor: "pointer" }}
        >
          {API_VERSIONS.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <p className="mono" style={{ margin: "7px 0 0", fontSize: 11, color: "var(--text-soft)", wordBreak: "break-all" }}>
          {buildBaseURL(config.environment, config.apiVersion)}
        </p>
      </div>

      {/* Keys */}
      <div style={{ marginBottom: 22 }}>
        <label style={label} htmlFor="pk">Public API key</label>
        <input id="pk" style={input} value={config.publicApiKey}
          onChange={(e) => onChange({ publicApiKey: e.target.value })}
          placeholder="public.xxxx.xxxx" autoComplete="off" spellCheck={false} />
      </div>
      <div style={{ marginBottom: 32 }}>
        <label style={label} htmlFor="sk">Secret API key</label>
        <input id="sk" style={input} type="password" value={config.secretApiKey}
          onChange={(e) => onChange({ secretApiKey: e.target.value })}
          placeholder="xxxx.xxxx" autoComplete="off" spellCheck={false} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onBack}
          style={{ padding: "13px 22px", fontSize: 14, fontWeight: 600, border: "1px solid var(--edge-strong)", background: "#fff", color: "var(--navy)", cursor: "pointer" }}>
          Back
        </button>
        <button onClick={onNext} disabled={!canContinue}
          style={{ flex: 1, padding: "13px", fontSize: 14, fontWeight: 600, border: "1px solid var(--navy)", background: canContinue ? "var(--navy)" : "var(--surface)", color: canContinue ? "#fff" : "var(--text-soft)", cursor: canContinue ? "pointer" : "not-allowed" }}>
          Continue to scenarios
        </button>
      </div>
    </div>
  );
}
