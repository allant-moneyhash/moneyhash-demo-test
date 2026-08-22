// Scenarios are data. Each declares the extra inputs it needs and how it shapes
// the create-intent payload. Adding a new scenario = adding an entry here, no
// engine changes. This is the "scenario as data" architecture.

export type ScenarioFieldKey = "customerId" | "cardToken";

export interface ScenarioField {
  key: ScenarioFieldKey;
  label: string;
  placeholder: string;
}

export interface ScenarioDef {
  id: string;
  name: string;
  blurb: string;
  // Extra inputs to reveal when this scenario is selected.
  fields: ScenarioField[];
  // Whether this scenario is fully wired end-to-end yet.
  ready: boolean;
  // Shapes the payload for this scenario. Receives the base (cart-derived) body
  // and the values of any revealed fields; returns the adjusted body.
  buildPayload: (
    base: Record<string, unknown>,
    values: Partial<Record<ScenarioFieldKey, string>>,
  ) => Record<string, unknown>;
  // A hint shown on the checkout stage (e.g. which test card to use).
  hint?: string;
}

const CUSTOMER_FIELD: ScenarioField = {
  key: "customerId",
  label: "Customer ID",
  placeholder: "customer id from your account",
};

const CARD_TOKEN_FIELD: ScenarioField = {
  key: "cardToken",
  label: "Card token",
  placeholder: "saved card token",
};

export const SCENARIOS: ScenarioDef[] = [
  {
    id: "basic-card",
    name: "Basic card payment",
    blurb: "A straightforward one-off card purchase.",
    fields: [],
    ready: true,
    buildPayload: (base) => ({ ...base, operation: "purchase" }),
    hint: "Use a success test card from your sandbox.",
  },
  {
    id: "card-3ds",
    name: "Card + 3DS",
    blurb: "Card payment that triggers a 3-D Secure challenge.",
    fields: [],
    ready: true,
    buildPayload: (base) => ({
      ...base,
      operation: "purchase",
      threeds: { enabled: true },
    }),
    hint: "Use a 3DS-challenge test card to see the authentication step.",
  },
  {
    id: "failed",
    name: "Failed payment",
    blurb: "A payment that declines, so you can show failure handling.",
    fields: [],
    ready: true,
    buildPayload: (base) => ({ ...base, operation: "purchase" }),
    hint: "Use a failure/decline test card from your sandbox.",
  },
  {
    id: "save-card",
    name: "Save card for future use",
    blurb: "Charge now and tokenize the card against a customer.",
    fields: [CUSTOMER_FIELD],
    ready: true,
    buildPayload: (base, v) => ({
      ...base,
      operation: "purchase",
      allow_tokenize_card: true,
      ...(v.customerId ? { customer: v.customerId } : {}),
    }),
    hint: "Provide a customer ID so the saved card is linked to them.",
  },
  {
    id: "pay-with-token",
    name: "Pay with saved token",
    blurb: "Charge a previously saved card token (returning customer).",
    fields: [CUSTOMER_FIELD, CARD_TOKEN_FIELD],
    ready: false,
    buildPayload: (base, v) => ({
      ...base,
      operation: "purchase",
      ...(v.customerId ? { customer: v.customerId } : {}),
      ...(v.cardToken ? { card_token: v.cardToken } : {}),
    }),
  },
  {
    id: "authorize-capture",
    name: "Authorize then capture",
    blurb: "Reserve funds now, capture later (pre-auth).",
    fields: [],
    ready: false,
    buildPayload: (base) => ({ ...base, operation: "authorize" }),
  },
  {
    id: "installments",
    name: "Installments",
    blurb: "Offer installment plans at checkout.",
    fields: [],
    ready: false,
    buildPayload: (base) => ({ ...base, operation: "purchase" }),
  },
  {
    id: "wallet",
    name: "Wallet",
    blurb: "Pay from a customer's stored wallet balance.",
    fields: [CUSTOMER_FIELD],
    ready: false,
    buildPayload: (base, v) => ({
      ...base,
      operation: "purchase",
      ...(v.customerId ? { customer: v.customerId } : {}),
    }),
  },
];

export const DEFAULT_SCENARIO_ID = "basic-card";

export function getScenario(id: string): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}
