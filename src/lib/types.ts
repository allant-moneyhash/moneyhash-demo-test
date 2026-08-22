// Core types for the MoneyHash demo tool.
// A "scenario" is data: a list of steps the engine runs. This is what lets us
// add External API / Direct API later as new step definitions, not new code.

export type Environment = "sandbox" | "production";

// The environments map to MoneyHash base URLs. Sandbox is the safe default.
export const ENVIRONMENTS: Record<Environment, { label: string; baseURL: string }> = {
  sandbox: {
    label: "Sandbox (staging)",
    baseURL: "https://staging-web.moneyhash.io/api/v1.1",
  },
  production: {
    label: "Production (live money — careful)",
    baseURL: "https://web.moneyhash.io/api/v1.1",
  },
};

// How the checkout is rendered once the intent exists.
export type IntegrationType = "sdk" | "iframe" | "redirect";

export const INTEGRATION_TYPES: Record<IntegrationType, string> = {
  sdk: "JavaScript SDK (self-rendered)",
  iframe: "MoneyHash embed in an iframe",
  redirect: "Redirect to MoneyHash embed",
};

// Everything the user configures on the page. Keys are held here in memory only
// and sent to our own relay per-request; never persisted, never in the URL.
export interface DemoConfig {
  environment: Environment;
  publicApiKey: string;
  secretApiKey: string;
  integrationType: IntegrationType;
  // Raw JSON the user edits — becomes the create-intent request body.
  // Mirrors the shop's `...extraConfig` pattern: whatever you put here is sent.
  intentPayload: string;
}

// A single entry in the inspector panel (right side).
export type LogKind = "request" | "response" | "sdk-state" | "info" | "error";

export interface LogEntry {
  id: string;
  kind: LogKind;
  title: string;
  // Pretty-printed JSON or plain text shown in the expandable body.
  body?: string;
  timestamp: number;
}

// The final outcome the left panel routes on.
export type Outcome = "success" | "failed" | "cancelled" | "pending" | null;
