"use client";

import { useCallback, useRef, useState } from "react";
import { DemoConfig, buildBaseURL, LogEntry, LogKind, Outcome } from "./types";

interface IntentDetailsLike {
  intent?: { id?: string; status?: string };
  state?: string;
  stateDetails?: Record<string, unknown> | null;
  selectedMethod?: string | null;
  transaction?: unknown;
  [k: string]: unknown;
}

interface MethodLike {
  id: string;
  title: string;
  icons?: string[];
  confirmationRequired?: boolean;
}

interface MethodsResult {
  paymentMethods?: MethodLike[];
  expressMethods?: MethodLike[];
  savedCards?: unknown[];
  savedBankAccounts?: unknown[];
  customerBalances?: unknown[];
}

interface CardElement {
  mount: () => void;
  on: (event: string, cb: (data?: unknown) => void) => void;
}
interface Elements {
  create: (props: {
    elementType: string;
    elementOptions: Record<string, unknown>;
  }) => CardElement;
  on: (event: string, cb: (isValid: boolean) => void) => void;
}

interface AnyMoneyHash {
  getMethods: (o: Record<string, unknown>) => Promise<MethodsResult>;
  proceedWith: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  renderUrl: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  getIntentDetails: (id: string) => Promise<IntentDetailsLike>;
  elements: (o: Record<string, unknown>) => Elements;
  cardForm: {
    collect: () => Promise<unknown>;
    pay: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  };
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const clone: Record<string, unknown> = Array.isArray(obj)
    ? ([...(obj as unknown[])] as unknown as Record<string, unknown>)
    : { ...(obj as Record<string, unknown>) };
  for (const k of Object.keys(clone)) {
    if (
      /(^|_)(api)?key$|secret|password|cvv/i.test(k) &&
      typeof clone[k] === "string"
    ) {
      const v = clone[k] as string;
      clone[k] = v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-2)}` : "•••";
    } else if (clone[k] && typeof clone[k] === "object") {
      clone[k] = redact(clone[k]);
    }
  }
  return clone;
}

function outcomeForState(state?: string): Outcome {
  switch (state) {
    case "INTENT_PROCESSED":
      return "success";
    case "TRANSACTION_FAILED":
      return "failed";
    case "CLOSED":
      return "cancelled";
    case "EXPIRED":
      return "failed";
    default:
      return null;
  }
}

// "phase" tells the UI which button/action to present.
//  idle          → nothing started
//  methods-shown → methods loaded (methods-first), waiting for pick + pay
//  running       → a payment is in progress
//  done          → terminal outcome reached
export type Phase = "idle" | "methods-shown" | "running" | "done";

export function useCheckout() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [methods, setMethods] = useState<MethodLike[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const mhRef = useRef<AnyMoneyHash | null>(null);
  const configRef = useRef<DemoConfig | null>(null);
  const intentIdRef = useRef<string | null>(null);
  // The isolated DOM node the SDK/iframe render into (set by the page via ref).
  const stageRef = useRef<HTMLElement | null>(null);

  const setStage = useCallback((el: HTMLElement | null) => {
    stageRef.current = el;
  }, []);

  const clearStage = useCallback(() => {
    if (stageRef.current) stageRef.current.innerHTML = "";
  }, []);

  const add = useCallback(
    (
      kind: LogKind,
      title: string,
      body?: unknown,
      extra?: { status?: string; durationMs?: number },
    ) => {
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
          status: extra?.status,
          durationMs: extra?.durationMs,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  const reset = useCallback(() => {
    setLog([]);
    setOutcome(null);
    setPhase("idle");
    setMethods([]);
    setSelectedMethodId(null);
    intentIdRef.current = null;
    clearStage();
  }, [clearStage]);

  const createIntent = useCallback(
    async (
      config: DemoConfig,
      body: Record<string, unknown>,
      baseURL: string,
    ) => {
      add("request", "Create intent → POST /payments/intent/", {
        endpoint: `${baseURL}/payments/intent/`,
        body,
      });
      const t0 = performance.now();
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
        const dt = Math.round(performance.now() - t0);
        if (!res.ok) {
          add("error", "Create intent failed.", json, {
            status: String(res.status),
            durationMs: dt,
          });
          return null;
        }
        add("response", "Intent created.", json.data, {
          status: String(res.status),
          durationMs: dt,
        });
        const d = json.data ?? {};
        const inner = d.data ?? d;
        const intentId = inner?.id || d?.id || inner?.intent?.id;
        const embedUrl =
          inner?.embed_url ||
          d?.embed_url ||
          inner?.state_details?.embed_url ||
          inner?.stateDetails?.embed_url;
        if (!intentId) {
          add("error", "No intent id found in the response.", json.data);
          return null;
        }
        intentIdRef.current = intentId;
        return { intentId, embedUrl };
      } catch (err) {
        add("error", "Network error creating intent.", String(err));
        return null;
      }
    },
    [add],
  );

  const buildSdk = useCallback(
    async (config: DemoConfig): Promise<AnyMoneyHash | null> => {
      if (mhRef.current) return mhRef.current;
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
        return null;
      }
      add("sdk-call", "SDK: new MoneyHash({ type: 'payment', publicApiKey })", {
        type: "payment",
        publicApiKey: config.publicApiKey,
      });
      const mh = new MoneyHash({
        type: "payment",
        publicApiKey: config.publicApiKey,
        onComplete: (event: unknown) => {
          add("sdk-state", "onComplete fired", event);
          setOutcome("success");
          setPhase("done");
        },
        onFail: (event: unknown) => {
          add("sdk-state", "onFail fired", event);
          setOutcome("failed");
          setPhase("done");
        },
      });
      mhRef.current = mh;
      return mh;
    },
    [add],
  );

  const handleState = useCallback(
    async (
      mh: AnyMoneyHash,
      details: IntentDetailsLike,
    ): Promise<IntentDetailsLike> => {
      let current = details;
      for (let i = 0; i < 5; i++) {
        add("sdk-state", `SDK state: ${current.state ?? "unknown"}`, current);
        if (outcomeForState(current.state)) return current;
        if (current.state === "URL_TO_RENDER") {
          const sd = current.stateDetails as
            | { url?: string; renderStrategy?: string }
            | undefined;
          if (sd?.url) {
            add("sdk-call", "SDK: renderUrl (3DS / external action)", {
              url: sd.url,
              renderStrategy: sd.renderStrategy,
            });
            try {
              current = await mh.renderUrl({
                intentId: intentIdRef.current ?? "",
                url: sd.url,
                renderStrategy: sd.renderStrategy || "IFRAME",
              });
              add("response", "SDK: renderUrl resolved", current);
              continue;
            } catch (err) {
              add("error", "renderUrl failed.", err);
              return current;
            }
          }
        }
        return current;
      }
      return current;
    },
    [add],
  );

  // Render card fields into the ISOLATED stage, collect, and pay.
  const renderCardAndPay = useCallback(
    async (mh: AnyMoneyHash, config: DemoConfig, intentId: string) => {
      const stage = stageRef.current;
      if (!stage) {
        add("error", "Checkout stage not ready.");
        return;
      }
      stage.innerHTML = `
        <div style="max-width:420px;font-family:var(--sans)">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px">Card details</div>
          <label style="font-size:11px;color:#5a626e">Card number</label>
          <div id="mh-card-number" style="height:42px;border:1px solid #e9e5db;border-radius:8px;margin:4px 0 10px;padding:0 4px"></div>
          <div style="display:flex;gap:10px">
            <div style="flex:1"><label style="font-size:11px;color:#5a626e">Exp. month</label>
              <div id="mh-card-exp-month" style="height:42px;border:1px solid #e9e5db;border-radius:8px;margin:4px 0 10px;padding:0 4px"></div></div>
            <div style="flex:1"><label style="font-size:11px;color:#5a626e">Exp. year</label>
              <div id="mh-card-exp-year" style="height:42px;border:1px solid #e9e5db;border-radius:8px;margin:4px 0 10px;padding:0 4px"></div></div>
            <div style="flex:1"><label style="font-size:11px;color:#5a626e">CVV</label>
              <div id="mh-card-cvv" style="height:42px;border:1px solid #e9e5db;border-radius:8px;margin:4px 0 10px;padding:0 4px"></div></div>
          </div>
          <label style="font-size:11px;color:#5a626e">Card holder name (optional)</label>
          <div id="mh-card-holder" style="height:42px;border:1px solid #e9e5db;border-radius:8px;margin:4px 0 14px;padding:0 4px"></div>
          <button id="mh-pay-btn" style="width:100%;padding:12px;border:none;border-radius:9px;background:var(--signal);color:#fff;font-weight:600;font-size:14px;cursor:pointer">Pay now</button>
          <div id="rendered-url-iframe-container" style="margin-top:16px"></div>
        </div>`;

      add("sdk-call", "SDK: elements() + create card fields", {
        fields: [
          "cardNumber",
          "cardExpiryMonth",
          "cardExpiryYear",
          "cardCvv",
          "cardHolderName",
        ],
      });

      const elements = mh.elements({
        styles: { fontSize: "14px", padding: "10px" },
      });
      const mk = (
        elementType: string,
        selector: string,
        placeholder: string,
      ) => {
        const el = elements.create({
          elementType,
          elementOptions: { selector, placeholder },
        });
        el.mount();
      };
      mk("cardNumber", "#mh-card-number", "1234 5678 9012 3456");
      mk("cardExpiryMonth", "#mh-card-exp-month", "MM");
      mk("cardExpiryYear", "#mh-card-exp-year", "YY");
      mk("cardCvv", "#mh-card-cvv", "123");
      mk("cardHolderName", "#mh-card-holder", "Name on card");

      const payBtn = stage.querySelector("#mh-pay-btn") as HTMLButtonElement;
      if (payBtn) {
        payBtn.onclick = async () => {
          payBtn.disabled = true;
          payBtn.textContent = "Processing…";
          try {
            add("sdk-call", "SDK: cardForm.collect()");
            const t0 = performance.now();
            const cardData = await mh.cardForm.collect();
            add("response", "SDK: card data collected", cardData, {
              durationMs: Math.round(performance.now() - t0),
            });
            const saveCard = config.scenarioId === "save-card";
            add(
              "sdk-call",
              "SDK: cardForm.pay({ intentId, cardData, saveCard })",
              { intentId, saveCard },
            );
            const t1 = performance.now();
            let details = await mh.cardForm.pay({ intentId, cardData, saveCard });
            add("response", "SDK: pay returned", details, {
              durationMs: Math.round(performance.now() - t1),
            });
            details = await handleState(mh, details);
            const oc = outcomeForState(details.state);
            if (oc) {
              setOutcome(oc);
              setPhase("done");
            }
          } catch (err) {
            add("error", "Card payment failed.", err);
            payBtn.disabled = false;
            payBtn.textContent = "Pay now";
          }
        };
      }
    },
    [add, handleState],
  );

  // Enrich the payload once, shared by all flows.
  const parsePayload = useCallback(
    (config: DemoConfig): Record<string, unknown> | null => {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(config.intentPayload);
      } catch {
        add("error", "Intent payload is not valid JSON.");
        return null;
      }
      mergeFields(body, config);
      return body;
    },
    [add],
  );

  // ---- Public action 1: Load methods (methods-first only) ----
  const loadMethods = useCallback(
    async (config: DemoConfig) => {
      reset();
      setBusy(true);
      setPhase("running");
      configRef.current = config;

      const body = parsePayload(config);
      if (!body) {
        setBusy(false);
        setPhase("idle");
        return;
      }
      const mh = await buildSdk(config);
      if (!mh) {
        setBusy(false);
        setPhase("idle");
        return;
      }
      add("sdk-call", "SDK: getMethods({ currency, amount, flowId })", {
        currency: body.amount_currency,
        amount: body.amount,
        flowId: config.flowId || undefined,
      });
      try {
        const t0 = performance.now();
        const res = await mh.getMethods({
          currency: body.amount_currency,
          amount: body.amount,
          ...(config.flowId ? { flowId: config.flowId } : {}),
          ...(config.scenarioValues.customerId
            ? { customer: config.scenarioValues.customerId }
            : {}),
        });
        add("response", "SDK: methods returned", res, {
          durationMs: Math.round(performance.now() - t0),
        });
        setMethods(res.paymentMethods ?? []);
        setPhase("methods-shown");
      } catch (err) {
        add("error", "getMethods failed.", err);
        setPhase("idle");
      }
      setBusy(false);
    },
    [add, reset, parsePayload, buildSdk],
  );

  // ---- Public action 2: Pay (methods-first, after a method is selected) ----
  const payNow = useCallback(
    async (config: DemoConfig) => {
      if (!selectedMethodId) {
        add("info", "Pick a payment method first.");
        return;
      }
      const mh = mhRef.current;
      if (!mh) {
        add("error", "SDK not initialised. Load methods first.");
        return;
      }
      setBusy(true);
      setPhase("running");
      const baseURL = buildBaseURL(config.environment, config.apiVersion);

      const body = parsePayload(config);
      if (!body) {
        setBusy(false);
        return;
      }
      const created = await createIntent(config, body, baseURL);
      if (!created) {
        setBusy(false);
        return;
      }

      if (selectedMethodId === "CARD") {
        await renderCardAndPay(mh, config, created.intentId);
      } else {
        add("sdk-call", "SDK: proceedWith({ intentId, type:'method', id })", {
          intentId: created.intentId,
          id: selectedMethodId,
        });
        try {
          const details = await mh.proceedWith({
            intentId: created.intentId,
            type: "method",
            id: selectedMethodId,
          });
          add("response", "SDK: proceedWith returned", details);
          const final = await handleState(mh, details);
          const oc = outcomeForState(final.state);
          if (oc) {
            setOutcome(oc);
            setPhase("done");
          }
        } catch (err) {
          add("error", "proceedWith failed.", err);
        }
      }
      setBusy(false);
    },
    [
      add,
      selectedMethodId,
      parsePayload,
      createIntent,
      renderCardAndPay,
      handleState,
    ],
  );

  // ---- Public action 3: Start payment (intent-first SDK, and embed paths) ----
  const startPayment = useCallback(
    async (config: DemoConfig) => {
      reset();
      setBusy(true);
      setPhase("running");
      configRef.current = config;

      const baseURL = buildBaseURL(config.environment, config.apiVersion);
      const body = parsePayload(config);
      if (!body) {
        setBusy(false);
        setPhase("idle");
        return;
      }

      // Embed paths.
      if (
        config.integrationType === "iframe" ||
        config.integrationType === "redirect"
      ) {
        const created = await createIntent(config, body, baseURL);
        if (!created) {
          setBusy(false);
          return;
        }
        if (!created.embedUrl) {
          add(
            "error",
            "No embed_url returned. This flow may not be set up for embedded checkout.",
          );
          setBusy(false);
          return;
        }
        if (config.integrationType === "iframe") {
          add("info", "Rendering MoneyHash embed in an iframe.", {
            embedUrl: created.embedUrl,
          });
          if (stageRef.current) {
            stageRef.current.innerHTML = "";
            const iframe = document.createElement("iframe");
            iframe.src = created.embedUrl;
            iframe.style.cssText =
              "width:100%;height:100%;min-height:520px;border:none";
            stageRef.current.appendChild(iframe);
          }
        } else {
          add("info", "Redirecting to MoneyHash embed.", {
            embedUrl: created.embedUrl,
          });
          window.location.href = created.embedUrl;
        }
        setBusy(false);
        return;
      }

      // SDK intent-first.
      const mh = await buildSdk(config);
      if (!mh) {
        setBusy(false);
        return;
      }
      const created = await createIntent(config, body, baseURL);
      if (!created) {
        setBusy(false);
        return;
      }
      add("sdk-call", "SDK: getMethods({ intentId })", {
        intentId: created.intentId,
      });
      try {
        const t0 = performance.now();
        const res = await mh.getMethods({ intentId: created.intentId });
        add("response", "SDK: methods returned", res, {
          durationMs: Math.round(performance.now() - t0),
        });
        setMethods(res.paymentMethods ?? []);
        setPhase("methods-shown");
      } catch (err) {
        add("error", "getMethods failed.", err);
      }
      setBusy(false);
    },
    [add, reset, parsePayload, createIntent, buildSdk],
  );

  // Called when a method is picked (intent-first: intent already exists → pay).
  const selectMethod = useCallback(
    async (methodId: string) => {
      setSelectedMethodId(methodId);
      const config = configRef.current;
      const mh = mhRef.current;
      if (!config || !mh) return;

      // Intent-first: intent already created, so proceed straight to pay.
      if (config.methodTiming === "intent-first" && intentIdRef.current) {
        setBusy(true);
        setPhase("running");
        if (methodId === "CARD") {
          await renderCardAndPay(mh, config, intentIdRef.current);
        } else {
          add("sdk-call", "SDK: proceedWith({ intentId, type:'method', id })", {
            intentId: intentIdRef.current,
            id: methodId,
          });
          try {
            const details = await mh.proceedWith({
              intentId: intentIdRef.current,
              type: "method",
              id: methodId,
            });
            add("response", "SDK: proceedWith returned", details);
            const final = await handleState(mh, details);
            const oc = outcomeForState(final.state);
            if (oc) {
              setOutcome(oc);
              setPhase("done");
            }
          } catch (err) {
            add("error", "proceedWith failed.", err);
          }
        }
        setBusy(false);
      }
      // Methods-first: just record the selection; user clicks "Pay" next.
    },
    [add, renderCardAndPay, handleState],
  );

  return {
    log,
    busy,
    outcome,
    phase,
    methods,
    selectedMethodId,
    setStage,
    loadMethods,
    payNow,
    startPayment,
    selectMethod,
    reset,
  };
}

function mergeFields(body: Record<string, unknown>, config: DemoConfig) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const resultUrl = origin ? `${origin}/result` : "";
  const setIfAbsent = (key: string, value?: string) => {
    if (value && body[key] === undefined) body[key] = value;
  };
  setIfAbsent("flow_id", config.flowId);
  setIfAbsent("webhook_url", config.webhookUrl);
  setIfAbsent("successful_redirect_url", config.successUrl || resultUrl);
  setIfAbsent("failed_redirect_url", config.failUrl || resultUrl);
  setIfAbsent(
    "pending_external_action_redirect_url",
    config.pendingUrl || resultUrl,
  );
  setIfAbsent("time_expired_redirect_url", config.timeExpiredUrl || resultUrl);
  setIfAbsent("closed_redirect_url", config.closedUrl || resultUrl);
  setIfAbsent("back_url", config.backUrl || resultUrl);
}
