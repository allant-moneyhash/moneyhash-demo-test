"use client";

import { useCallback, useRef, useState } from "react";
import { DemoConfig, buildBaseURL, LogEntry, LogKind, Outcome } from "./types";

// Minimal shape of the SDK instance we use.
interface IntentDetailsLike {
  intent?: { id?: string; status?: string };
  state?: string;
  stateDetails?: unknown;
  selectedMethod?: string | null;
  transaction?: unknown;
  [k: string]: unknown;
}

interface AnyMoneyHash {
  getMethods: (o: Record<string, unknown>) => Promise<unknown>;
  renderForm: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  getIntentDetails: (id: string) => Promise<IntentDetailsLike>;
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

// Redact obvious secrets before logging any object.
function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const clone: Record<string, unknown> = Array.isArray(obj)
    ? ([...(obj as unknown[])] as unknown as Record<string, unknown>)
    : { ...(obj as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (/key|secret|token|cvv|password/i.test(k) && typeof clone[k] === "string") {
      const v = clone[k] as string;
      clone[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-2)}` : "•••";
    } else if (clone[k] && typeof clone[k] === "object") {
      clone[k] = redact(clone[k]);
    }
  }
  return clone;
}

export function useCheckout() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const intentIdRef = useRef<string | null>(null);

  const add = useCallback((kind: LogKind, title: string, body?: unknown) => {
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
              : JSON.stringify(redact(body), null, 2),
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const reset = useCallback(() => {
    setLog([]);
    setOutcome(null);
    intentIdRef.current = null;
  }, []);

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

      // 1) Parse the payload.
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(config.intentPayload);
      } catch {
        add("error", "Intent payload is not valid JSON.");
        setBusy(false);
        return;
      }

      // Merge dedicated fields (raw JSON wins if already set).
      const setIfAbsent = (key: string, value: string) => {
        if (value && body[key] === undefined) body[key] = value;
      };
      setIfAbsent("flow_id", config.flowId);
      setIfAbsent("webhook_url", config.webhookUrl);
      setIfAbsent("successful_redirect_url", config.successUrl);
      setIfAbsent("failed_redirect_url", config.failUrl);
      setIfAbsent("pending_external_action_redirect_url", config.pendingUrl);
      setIfAbsent("time_expired_redirect_url", config.timeExpiredUrl);
      setIfAbsent("closed_redirect_url", config.closedUrl);
      setIfAbsent("back_url", config.backUrl);

      // 2) Create the intent through the relay.
      add("request", "Create intent → POST /payments/intent/", {
        endpoint: `${baseURL}/payments/intent/`,
        body,
      });

      let intentId: string;
      let embedUrl: string | undefined;
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

        // MoneyHash wraps the payload; the intent lives under data.data most of
        // the time, but check the common locations to be safe.
        const d = json.data ?? {};
        const inner = d.data ?? d;
        intentId = inner?.id || d?.id || inner?.intent?.id;

        // The embed URL for iframe/redirect integration comes back on the
        // intent response. Check the documented and wrapped locations.
        embedUrl =
          inner?.embed_url ||
          d?.embed_url ||
          inner?.embedUrl ||
          inner?.state_details?.embed_url ||
          inner?.stateDetails?.embed_url;

        if (!intentId) {
          add("error", "No intent id found in the response.", json.data);
          setBusy(false);
          return;
        }
        intentIdRef.current = intentId;
      } catch (err) {
        add("error", "Network error creating intent.", String(err));
        setBusy(false);
        return;
      }

      // 3) Embed paths: use the real embed_url from the intent response.
      if (
        config.integrationType === "iframe" ||
        config.integrationType === "redirect"
      ) {
        if (!embedUrl) {
          add(
            "error",
            "No embed_url was returned on the intent. For the embed paths, the intent response must include embed_url. Check that this integration/flow is configured for embedded checkout.",
          );
          setBusy(false);
          return;
        }

        if (config.integrationType === "iframe") {
          add("info", "Rendering MoneyHash embed in an iframe.", { embedUrl });
          const container = document.getElementById("mh-embed");
          if (container) {
            container.innerHTML = "";
            const iframe = document.createElement("iframe");
            iframe.src = embedUrl;
            iframe.style.width = "100%";
            iframe.style.height = "100%";
            iframe.style.minHeight = "520px";
            iframe.style.border = "none";
            container.appendChild(iframe);
          }
          add(
            "info",
            "Customer is completing payment in the embed. Final status arrives via redirect/webhook.",
          );
        } else {
          add("info", "Redirecting to MoneyHash embed.", { embedUrl });
          window.location.href = embedUrl;
        }
        setBusy(false);
        return;
      }

      // 4) SDK path: init, log, getMethods, renderForm — all instrumented.
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

      add("sdk-call", "SDK: new MoneyHash({ type: 'payment', publicApiKey })", {
        type: "payment",
        publicApiKey: config.publicApiKey,
        apiVersion: config.apiVersion,
      });

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

      // getMethods — logged
      try {
        add("sdk-call", "SDK: getMethods({ intentId })", { intentId });
        const methods = await mh.getMethods({ intentId });
        add("response", "SDK: methods returned", methods);
      } catch (err) {
        add("error", "SDK getMethods failed.", String(err));
      }

      // renderForm — MoneyHash handles the UI; we log the call and the result.
      try {
        add("sdk-call", "SDK: renderForm({ selector: '#mh-embed', intentId })", {
          intentId,
        });
        const details = await mh.renderForm({
          selector: "#mh-embed",
          intentId,
        });
        applyState(details);
      } catch (err) {
        add("error", "SDK renderForm failed.", String(err));
      }

      setBusy(false);
    },
    [add, applyState, reset],
  );

  return { log, busy, outcome, start, reset };
}
