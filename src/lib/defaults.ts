import { DemoConfig, DEFAULT_API_VERSION, EMPTY_CONTACT, Product } from "./types";

// A starter intent payload. Mirrors the shop's create-intent body but trimmed to
// the essentials. The user can edit this freely — add flow_id, billing_data,
// allow_tokenize_card, whatever the scenario needs.
export const DEFAULT_INTENT_PAYLOAD = {
  amount: 50,
  amount_currency: "AED",
  operation: "purchase",
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
      description: "A demo product for testing the checkout",
    },
  ],
  // Keeps the SDK embed compact when we render it ourselves.
  form_only: true,
};

export const DEFAULT_CONFIG: DemoConfig = {
  environment: "sandbox",
  apiVersion: DEFAULT_API_VERSION,
  publicApiKey: "",
  secretApiKey: "",
  integrationType: "sdk",
  methodTiming: "methods-first",
  scenarioId: "basic-card",
  scenarioValues: {},
  flowId: "",
  webhookUrl: "",
  successUrl: "",
  failUrl: "",
  pendingUrl: "",
  timeExpiredUrl: "",
  closedUrl: "",
  backUrl: "",
  intentPayload: JSON.stringify(DEFAULT_INTENT_PAYLOAD, null, 2),
  billing: { ...EMPTY_CONTACT },
  shipping: { ...EMPTY_CONTACT },
  shippingSameAsBilling: true,
};

// Common currencies to offer as quick picks.
export const QUICK_CURRENCIES = ["AED", "SAR", "EGP", "USD", "EUR", "GBP"];

// Three dummy products for the storefront. Prices are per-currency.
// emoji + tint give each a simple, dependency-free visual.
export const PRODUCTS: Product[] = [
  {
    id: "tote",
    name: "Canvas Tote Bag",
    blurb: "Everyday carry, heavyweight cotton",
    description: "A durable heavyweight cotton tote bag for everyday use.",
    price: { AED: 55, SAR: 55, EGP: 450, USD: 15, EUR: 14, GBP: 12 },
    emoji: "👜",
    tint: "#e8e0d2",
    image: "/products/tote.svg",
  },
  {
    id: "headphones",
    name: "Wireless Headphones",
    blurb: "Over-ear, 30-hour battery",
    description: "Over-ear wireless headphones with 30-hour battery life.",
    price: { AED: 320, SAR: 320, EGP: 2600, USD: 89, EUR: 82, GBP: 72 },
    emoji: "🎧",
    tint: "#d6e2e6",
    image: "/products/headphones.svg",
  },
  {
    id: "notebook",
    name: "Dotted Notebook",
    blurb: "A5, 192 pages, lay-flat binding",
    description: "An A5 dotted notebook with 192 pages and lay-flat binding.",
    price: { AED: 40, SAR: 40, EGP: 320, USD: 11, EUR: 10, GBP: 9 },
    emoji: "📓",
    tint: "#e6dde6",
    image: "/products/notebook.svg",
  },
];
