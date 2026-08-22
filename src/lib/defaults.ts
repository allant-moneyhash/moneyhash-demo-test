import { DemoConfig } from "./types";

// A starter intent payload. Mirrors the shop's create-intent body but trimmed to
// the essentials. The user can edit this freely — add flow_id, billing_data,
// allow_tokenize_card, whatever the scenario needs.
export const DEFAULT_INTENT_PAYLOAD = {
  amount: 50,
  amount_currency: "AED",
  // Uncomment / add fields as needed for your scenario:
  // flow_id: "<your-flow-id>",
  billing_data: {
    first_name: "Demo",
    last_name: "Customer",
    email: "demo@example.com",
    phone_number: "+971500000000",
  },
  product_items: [
    {
      name: "Demo product",
      amount: 50,
      quantity: 1,
      type: "digital",
      category: "demo",
      reference_id: "demo-1",
    },
  ],
  // Keeps the SDK embed compact when we render it ourselves.
  form_only: true,
};

export const DEFAULT_CONFIG: DemoConfig = {
  environment: "sandbox",
  publicApiKey: "",
  secretApiKey: "",
  integrationType: "sdk",
  intentPayload: JSON.stringify(DEFAULT_INTENT_PAYLOAD, null, 2),
};

// Common currencies to offer as quick picks (writes into the payload).
export const QUICK_CURRENCIES = ["AED", "SAR", "EGP", "USD", "EUR", "GBP"];
