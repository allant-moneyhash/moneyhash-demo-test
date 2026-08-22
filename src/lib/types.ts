// Core types for the MoneyHash demo tool.
// A "scenario" is data: a list of steps the engine runs. This is what lets us
// add External API / Direct API later as new step definitions, not new code.

export type Environment = "sandbox" | "production";

// Each environment is just a host. The API version is chosen separately, so the
// base URL is built from host + version at request time.
export const ENVIRONMENTS: Record<Environment, { label: string; host: string }> = {
  sandbox: {
    label: "Sandbox (staging)",
    host: "https://staging-web.moneyhash.io",
  },
  production: {
    label: "Production (live money — careful)",
    host: "https://web.moneyhash.io",
  },
};

// Selectable API versions. Defaults to the current documented version.
export const API_VERSIONS = ["v1.1", "v1.2", "v1.3", "v1.4"] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];
export const DEFAULT_API_VERSION: ApiVersion = "v1.4";

// Build the full base URL from environment + version.
export function buildBaseURL(env: Environment, version: ApiVersion): string {
  return `${ENVIRONMENTS[env].host}/api/${version}`;
}

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
  apiVersion: ApiVersion;
  publicApiKey: string;
  secretApiKey: string;
  integrationType: IntegrationType;
  // For the SDK path: whether to fetch methods before creating the intent
  // ("methods-first") or create the intent first then fetch its methods
  // ("intent-first"). Both are valid MoneyHash flows.
  methodTiming: "methods-first" | "intent-first";
  // Selected scenario id and the values for any fields it reveals.
  scenarioId: string;
  scenarioValues: Record<string, string>;
  // Optional flow id, auto-added to the payload when set.
  flowId: string;
  // Webhook URL MoneyHash will fire events to (e.g. a webhook.site inbox).
  webhookUrl: string;
  // The full family of redirect URLs MoneyHash supports on intent creation,
  // per https://docs.moneyhash.io/docs/redirects
  successUrl: string;
  failUrl: string;
  pendingUrl: string; // pending_external_action_redirect_url
  timeExpiredUrl: string;
  closedUrl: string;
  backUrl: string; // extra field used by the shop
  // Raw JSON the user edits — becomes the create-intent request body.
  // Mirrors the shop's `...extraConfig` pattern: whatever you put here is sent.
  intentPayload: string;
}

// A single entry in the inspector panel (right side).
export type LogKind = "request" | "response" | "sdk-call" | "sdk-state" | "info" | "error";

export interface LogEntry {
  id: string;
  kind: LogKind;
  title: string;
  // Pretty-printed JSON or plain text shown in the expandable body.
  body?: string;
  // Optional status label (e.g. "200", "400", "OK") and duration in ms.
  status?: string;
  durationMs?: number;
  timestamp: number;
}

// The final outcome the left panel routes on.
export type Outcome = "success" | "failed" | "cancelled" | "pending" | null;

// Storefront product. Prices are keyed by currency for simple multi-currency
// display (a demo relabel, not live FX).
export interface Product {
  id: string;
  name: string;
  blurb: string;
  description: string;
  // price per currency code
  price: Record<string, number>;
  emoji: string;
  tint: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
