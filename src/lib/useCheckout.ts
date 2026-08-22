"use client";

import { useCallback, useRef, useState } from "react";
import { DemoConfig, buildBaseURL, LogEntry, LogKind, Outcome } from "./types";

// We import the headless SDK dynamically inside the browser only, so it never
// runs on the server during build.
type AnyMoneyHash = {
  getMethods: (o: Record<string, unknown>) => Promise<unknown>;
  proceedWith: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  renderForm: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  renderUrl: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  getIntentDetails: (id: string) => Promise<IntentDetailsLike>;
};

interface IntentDetailsLike {
  intent?: { id?: string; status?: string };
  state?: string;
  stateDetails?: unknown;
  selectedMethod?: string | null;
  transaction?: unknown;
  [k: string]: unknown;
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export function useCheckout() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const mhRef = useRef<AnyMoneyHash | null>(null);
  const intentIdRef = useRef<string | null>(null);

  const add = useCallback(
    (kind: LogKind, title: string, body?: unknown) => {
      setLog((prev) => [
        ...prev,
        {
          id: nextId(),
          kind,
          title,
          body:
            body === undefined
              ? undefined
              : typeof body === "string"
                ? body
                : JSON.stringify(body, null, 2),
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  const reset = useCallback(() => {
    setLog([]);
    setOutcome(null);
    intentIdRef.current = null;
  }, []);

  // Map an SDK intent "state" onto our success/failed/cancelled outcome.
  const applyState = useCallback(
    (details: IntentDetailsLike) => {
      const state = details.state;
      add("sdk-state", `SDK state: ${state ?? "unknown"}`, details);

      switch (state) {
        case "INTENT_PROCESSED":
          setOutcome("success");
          return true;
        case "TRANSACTION_FAILED":
          setOutcome("failed");
          return true;
        case "CLOSED":
          setOutcome("cancelled");
          return true;
        case "EXPIRED":
          setOutcome("failed");
          return true;
        default:
          return false;
      }
    },
    [add],
  );

  const start = useCallback(
    async (config: DemoConfig) => {
      reset();
      setBusy(true);

      const baseURL = buildBaseURL(config.environment, config.apiVersion);

      // 1) Parse the payload the user configured.
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(config.intentPayload);
      } catch {
        add("error", "Intent payload is not valid JSON.");
        setBusy(false);
        return;
      }

      // 2) Create the intent through our relay (keeps secret key off the page).
      add("request", "Create intent → POST /payments/intent/", {
        endpoint: `${baseURL}/payments/intent/`,
        body,
      });

      let intentId: string;
      try {
        const res = await fetch("/api/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseURL,
            secretApiKey: config.secretApiKey,
            body,
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          add("error", "Create intent failed.", json);
          setBusy(false);
          return;
        }

        add("response", "Intent created.", json.data);
        intentId =
          json.data?.id ||
          json.data?.data?.id ||
          json.data?.intent?.id;

        if (!intentId) {
          add(
            "error",
            "Could not find an intent id in the response. Check the payload shape.",
            json.data,
          );
          setBusy(false);
          return;
        }
        intentIdRef.current = intentId;
      } catch (err) {
        add("error", "Network error creating intent.", String(err));
        setBusy(false);
        return;
      }

      // 3) Load the SDK in the browser.
      let MoneyHash: new (o: Record<string, unknown>) => AnyMoneyHash;
      try {
        const mod = await import("@moneyhash/js-sdk/headless");
        MoneyHash = (mod.default ||
          (mod as unknown as { MoneyHash: typeof mod.default })
            .MoneyHash) as unknown as new (
          o: Record<string, unknown>,
        ) => AnyMoneyHash;
      } catch (err) {
        add("error", "Could not load the MoneyHash SDK.", String(err));
        setBusy(false);
        return;
      }

      const mh = new MoneyHash({
        type: "payment",
        publicApiKey: config.publicApiKey,
        onComplete: (event: unknown) => {
          add("sdk-state", "onComplete fired", event);
          setOutcome("success");
        },
        onFail: (event: unknown) => {
          add("sdk-state", "onFail fired", event);
          setOutcome("failed");
        },
      });
      mhRef.current = mh;

      // 4) For iframe / redirect integration, hand the whole intent to MoneyHash.
      if (
        config.integrationType === "iframe" ||
        config.integrationType === "redirect"
      ) {
        add(
          "info",
          config.integrationType === "iframe"
            ? "Rendering MoneyHash embed inside the page."
            : "Handing off to MoneyHash embed.",
        );
        try {
          const details = await mh.renderForm({
            selector: "#mh-embed",
            intentId,
          });
          applyState(details);
        } catch (err) {
          add("error", "Embed render failed.", String(err));
        }
        setBusy(false);
        return;
      }

      // 5) SDK (self-rendered) path: get methods, then render the form so the
      //    user can complete payment. We surface the methods so the demo shows
      //    what Get Methods returned.
      try {
        add("request", "Get methods for this intent", { intentId });
        const methods = await mh.getMethods({ intentId });
        add("response", "Methods returned.", methods);
      } catch (err) {
        add("error", "Get methods failed.", String(err));
      }

      // Render the SDK form into the embed container to complete the payment.
      try {
        add("info", "Rendering SDK checkout form.");
        const details = await mh.renderForm({
          selector: "#mh-embed",
          intentId,
        });
        applyState(details);
      } catch (err) {
        add("error", "SDK form render failed.", String(err));
      }

      setBusy(false);
    },
    [add, applyState, reset],
  );

  return { log, busy, outcome, start, reset };
}
