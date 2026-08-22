# MoneyHash Demo Tool

An interactive, sandbox-first checkout demo. Configure keys, an environment, an
integration type, and a raw JSON intent payload, then watch every API call and
SDK state stream into the inspector panel on the right.

## Running locally (optional)
```
npm install
npm run dev
```
Then open http://localhost:3000

## Deploying
Push to GitHub and import into Vercel. No environment variables are required —
all keys are entered on the page at runtime and are never stored.

## How it works
- The left panel is the configuration surface (keys, environment, integration
  type, currency quick-pick, and a raw JSON payload editor).
- The middle panel is the working checkout where the SDK / embed renders.
- The right panel is the inspector: it logs each request, response, and SDK
  state as the payment runs.
- Intent creation goes through a small serverless relay (`/api/create-intent`)
  so the secret key is used per-request and never sits in the browser tab.

## Notes
- Sandbox is the default and recommended environment.
- Redirect / success / failure is driven by the SDK's intent state and
  MoneyHash's redirect URLs (no webhook receiver needed for the demo).
