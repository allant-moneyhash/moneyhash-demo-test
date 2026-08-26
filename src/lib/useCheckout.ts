"use client";

import { useCallback, useRef, useState } from "react";
import { DemoConfig, buildBaseURL, ENVIRONMENTS, LogEntry, LogKind, Outcome } from "./types";

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
  requiredBillingFields?: unknown[] | null;
  requiredShippingFields?: unknown[] | null;
  // Which bucket this came from — determines how we proceed with it.
  kind?: "method" | "express" | "customerBalance" | "savedCard";
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
  submitPaymentReceipt: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  validateApplePayMerchantSession: (o: Record<string, unknown>) => Promise<unknown>;
  renderForm: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  setIntentSecret: (secret: string) => void;
  submitForm: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  submitCvv: (o: Record<string, unknown>) => Promise<IntentDetailsLike>;
  resetSelectedMethod: (intentId: string) => Promise<IntentDetailsLike>;
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

// Combine the non-express buckets into one tagged list to render as the
// regular method list. Express methods (Google/Apple Pay) are handled
// separately as native buttons at the top.
function flattenMethods(res: MethodsResult): MethodLike[] {
  const tag = (arr: unknown[] | undefined, kind: MethodLike["kind"]) =>
    (arr ?? []).map((m) => ({ ...(m as MethodLike), kind }));

  const allPay = tag(res.paymentMethods, "method");
  const card = allPay.filter((m) => m.id === "CARD");
  const otherPay = allPay.filter((m) => m.id !== "CARD");
  const saved = tag(res.savedCards as unknown[], "savedCard").map((m) => ({
    ...m,
    title: m.title || `Saved card ${m.id}`,
  }));
  const balances = tag(res.customerBalances as unknown[], "customerBalance").map(
    (m) => ({
      ...m,
      title:
        m.title ||
        (m.id === "SELFSERVE_WALLET" ? "Wallet balance" : `Balance ${m.id}`),
    }),
  );

  // Card first, then other methods, saved cards, balances.
  return [...card, ...otherPay, ...saved, ...balances];
}

// Extract express methods (Google/Apple Pay) for native buttons.
function extractExpress(res: MethodsResult): MethodLike[] {
  return (res.expressMethods ?? []).map((m) => ({
    ...(m as MethodLike),
    kind: "express" as const,
  }));
}

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
    case "CARD_INTENT_SUCCESSFUL":
      return "success";
    case "TRANSACTION_FAILED":
      return "failed";
    case "CARD_INTENT_FAILED":
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
  const [expressMethods, setExpressMethods] = useState<MethodLike[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const selectedMethodRef = useRef<MethodLike | null>(null);

  const mhRef = useRef<AnyMoneyHash | null>(null);
  const configRef = useRef<DemoConfig | null>(null);
  const intentIdRef = useRef<string | null>(null);
  const intentSecretRef = useRef<string | null>(null);
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
    setExpressMethods([]);
    setSelectedMethodId(null);
    selectedMethodRef.current = null;
    intentIdRef.current = null;
    intentSecretRef.current = null;
    mhRef.current = null;
    clearStage();
  }, [clearStage]);

  // Clears just the inspector log, leaving the current run/state intact.
  const clearLog = useCallback(() => setLog([]), []);

  // Navigate to the /result page for a terminal outcome, so SDK/native flows
  // land on the same success/fail page as the embed redirect flows.
  const goToResult = useCallback((outcomeKind: Outcome) => {
    if (!outcomeKind) return;
    const statusMap: Record<string, string> = {
      success: "SUCCESS",
      failed: "FAILED",
      cancelled: "CANCELLED",
      pending: "PENDING",
    };
    const status = statusMap[outcomeKind] || "PENDING";
    const intentId = intentIdRef.current ?? "";
    const params = new URLSearchParams({ status, intent_id: intentId });
    if (typeof window !== "undefined") {
      // Small delay so the final inspector lines are visible before leaving.
      setTimeout(() => {
        window.location.href = `/result?${params.toString()}`;
      }, 1200);
    }
  }, []);

  // Set a terminal outcome and navigate to the result page.
  const finish = useCallback(
    (oc: Outcome) => {
      if (!oc) return;
      setOutcome(oc);
      setPhase("done");
      goToResult(oc);
    },
    [goToResult],
  );

  // Public logging helper for child components (e.g. native pay buttons).
  const logInfo = useCallback(
    (msg: string, body?: unknown) => add("info", msg, body),
    [add],
  );

  const createIntent = useCallback(
    async (
      config: DemoConfig,
      body: Record<string, unknown>,
      baseURL: string,
      methodId?: string,
    ) => {
      // Repo model: create the intent WITH the selected payment_method.
      const finalBody =
        methodId && body.payment_method === undefined
          ? { ...body, payment_method: methodId }
          : body;
      add("request", "Create intent → POST /payments/intent/", {
        endpoint: `${baseURL}/payments/intent/`,
        body: finalBody,
      });
      const t0 = performance.now();
      try {
        const res = await fetch("/api/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseURL,
            secretApiKey: config.secretApiKey,
            body: finalBody,
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
        const intentSecret =
          inner?.intent_secret || d?.intent_secret || inner?.intentSecret;
        if (!intentId) {
          add("error", "No intent id found in the response.", json.data);
          return null;
        }
        intentIdRef.current = intentId;
        intentSecretRef.current = intentSecret || null;
        return { intentId, embedUrl, intentSecret, details: inner };
      } catch (err) {
        add("error", "Network error creating intent.", String(err));
        return null;
      }
    },
    [add],
  );

  // Give the SDK the intent secret so intent-scoped calls (getMethods by
  // intentId, proceedWith, cardForm.pay, renderForm) are authorized under
  // intent-secret enforcement. Available since SDK 2.14.0.
  const applyIntentSecret = useCallback(
    (mh: AnyMoneyHash) => {
      const secret = intentSecretRef.current;
      if (secret && typeof mh.setIntentSecret === "function") {
        mh.setIntentSecret(secret);
        add("sdk-call", "SDK: setIntentSecret(…)", { intentSecret: secret });
      }
    },
    [add],
  );

  const buildSdk = useCallback(
    async (config: DemoConfig): Promise<AnyMoneyHash | null> => {
      if (mhRef.current) return mhRef.current;

      // CRITICAL: the SDK's account-level calls (getMethods without an intent)
      // run through a hidden iframe whose host defaults to production
      // (embed.moneyhash.io). A sandbox key sent there returns 401. So we point
      // the SDK at the correct embed host for the chosen environment BEFORE the
      // SDK constructs (it reads this window var when creating its iframe).
      const env = ENVIRONMENTS[config.environment];
      const embedHost = env.embedHost;
      if (typeof window !== "undefined") {
        const w = window as unknown as {
          MONEYHASH_IFRAME_URL?: string;
          MONEYHASH_VAULT_API_URL?: string;
          MONEYHASH_VAULT_INPUT_IFRAME_URL?: string;
        };
        w.MONEYHASH_IFRAME_URL = embedHost;
        // The card fields + access-token generation talk to the vault, which
        // also defaults to production. Point it at the right vault per env,
        // otherwise cardForm.collect() fails with "Incorrect authentication
        // credentials" when a sandbox key hits the production vault.
        w.MONEYHASH_VAULT_API_URL = env.vaultApiUrl;
        w.MONEYHASH_VAULT_INPUT_IFRAME_URL = env.vaultFormUrl;
        // If a hidden SDK iframe already exists (e.g. from a previous env),
        // remove it so the SDK rebuilds it against the correct host.
        const existing = document.getElementById("moneyhash-headless-sdk");
        if (existing) existing.remove();
      }
      add(
        "info",
        `SDK hosts set — embed: ${embedHost}, vault: ${env.vaultApiUrl}`,
      );

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
          finish("success");
        },
        onFail: (event: unknown) => {
          add("sdk-state", "onFail fired", event);
          finish("failed");
        },
      });
      mhRef.current = mh;
      return mh;
    },
    [add, finish],
  );

  const handleState = useCallback(
    async (
      mh: AnyMoneyHash,
      details: IntentDetailsLike,
    ): Promise<IntentDetailsLike> => {
      let current = details;
      // Loop through the SDK state machine until we reach a terminal state.
      // Each state has a prescribed action per the MoneyHash docs.
      for (let i = 0; i < 12; i++) {
        add("sdk-state", `SDK state: ${current.state ?? "unknown"}`, {
          state: current.state,
          paymentStatus: (current as { paymentStatus?: unknown }).paymentStatus,
        });

        // Terminal states → stop.
        if (outcomeForState(current.state)) return current;

        const sd = (current.stateDetails ?? {}) as Record<string, unknown>;
        const cfg = configRef.current;

        try {
          if (current.state === "FORM_FIELDS") {
            // The card form (renderCardAndPay) owns collect()+cardForm.pay on
            // its pay button. If we land back here inside the loop, stop and let
            // the form drive it rather than auto-collecting.
            add("info", "FORM_FIELDS — awaiting card form submission.");
            return current;
          }

          if (current.state === "URL_TO_RENDER") {
            const url = sd.url as string | undefined;
            const renderStrategy = (sd.renderStrategy as string) || "IFRAME";
            if (url) {
              add("sdk-call", "SDK: renderUrl (3DS / external action)", {
                url,
                renderStrategy,
              });
              current = await mh.renderUrl({
                intentId: intentIdRef.current ?? "",
                url,
                renderStrategy,
              });
              add("response", "SDK: renderUrl resolved", current);
              continue;
            }
          }

          if (current.state === "SAVED_CARD_CVV") {
            // We don't have a CVV collection UI in the auto-flow; surface it.
            add(
              "info",
              "Saved-card CVV is required. Collect the CVV and call submitCvv (not wired in this demo path).",
            );
            return current;
          }

          if (current.state === "PROCESSING") {
            // Poll getIntentDetails until the state changes.
            add("info", "Payment processing — polling for the result…");
            await new Promise((r) => setTimeout(r, 2500));
            current = await mh.getIntentDetails(intentIdRef.current ?? "");
            add("response", "SDK: getIntentDetails (poll)", current);
            continue;
          }

          if (current.state === "TRANSACTION_WAITING_USER_ACTION") {
            add(
              "info",
              "Transaction is waiting on a user action. See intent details for the external action message.",
            );
            return current;
          }
        } catch (err) {
          add("error", `Handling state ${current.state} failed.`, err);
          return current;
        }

        // Unknown / no-action state → stop to avoid an infinite loop.
        return current;
      }
      add("info", "State machine reached the step limit; stopping.");
      return current;
    },
    [add],
  );

  // Render card fields into the ISOLATED stage. The pay button collects the
  // card data and calls cardForm.pay (repo model). Called when the intent is
  // in FORM_FIELDS (i.e. CARD was selected at creation or via proceedWith).

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

  // Ensure an intent exists (create it if methods-first hasn't yet). Returns id.
  const ensureIntent = useCallback(
    async (config: DemoConfig): Promise<string | null> => {
      if (intentIdRef.current) return intentIdRef.current;
      const baseURL = buildBaseURL(config.environment, config.apiVersion);
      const body = parsePayload(config);
      if (!body) return null;
      const created = await createIntent(config, body, baseURL);
      return created ? created.intentId : null;
    },
    [parsePayload, createIntent],
  );

  // Complete a native pay (Google/Apple) with a receipt obtained from the
  // native sheet: select the method, then submit the receipt.
  // Reset any previously-selected method on the intent so we can switch to a
  // different one on the SAME intent (one intent per checkout session). This
  // avoids "payment_method doesn't match" errors when the user tries one method
  // then another. Safe to call even if nothing was selected.
  const resetSelectedMethodSafe = useCallback(
    async (mh: AnyMoneyHash, intentId: string) => {
      try {
        add("sdk-call", "SDK: resetSelectedMethod(intentId)", { intentId });
        const d = await mh.resetSelectedMethod(intentId);
        add("response", "SDK: selected method reset", d);
      } catch (err) {
        // Non-fatal: if nothing was selected, the API may no-op or error.
        add("info", "resetSelectedMethod skipped/failed (non-fatal).", err);
      }
    },
    [add],
  );

  const submitNativeReceipt = useCallback(
    async (
      config: DemoConfig,
      methodId: string,
      receipt: Record<string, unknown>,
    ) => {
      const mh = mhRef.current || (await buildSdk(config));
      if (!mh) return;
      setBusy(true);
      setPhase("running");
      const intentId = await ensureIntent(config);
      if (!intentId) {
        setBusy(false);
        return;
      }
      applyIntentSecret(mh);
      try {
        // Reset any prior selection (e.g. CARD) so the native method matches.
        await resetSelectedMethodSafe(mh, intentId);
        add("sdk-call", `SDK: proceedWith({ type:'method', id:'${methodId}' })`, {
          intentId,
          id: methodId,
        });
        await mh.proceedWith({ intentId, type: "method", id: methodId });
        add("sdk-call", "SDK: submitPaymentReceipt(...)", { intentId });
        const details = await mh.submitPaymentReceipt({
          intentId,
          nativeReceiptData: receipt,
        });
        add("response", "SDK: submitPaymentReceipt returned", details);
        const final = await handleState(mh, details);
        const oc = outcomeForState(final.state);
        if (oc) finish(oc);
      } catch (err) {
        add("error", "Native payment failed.", err);
      }
      setBusy(false);
    },
    [add, buildSdk, ensureIntent, applyIntentSecret, resetSelectedMethodSafe, handleState, finish],
  );

  // Validate an Apple Pay merchant session (used by the Apple Pay button).
  const validateApplePay = useCallback(
    async (config: DemoConfig, methodId: string, validationUrl: string) => {
      const mh = mhRef.current || (await buildSdk(config));
      if (!mh) return null;
      try {
        return await mh.validateApplePayMerchantSession({
          methodId,
          validationUrl,
        });
      } catch (err) {
        add("error", "Apple Pay merchant validation failed.", err);
        return null;
      }
    },
    [add, buildSdk],
  );

  const renderCardAndPay = useCallback(
    async (mh: AnyMoneyHash, config: DemoConfig, intentId: string) => {
      const stage = stageRef.current;
      if (!stage) {
        add("error", "Checkout stage not ready.");
        return;
      }
      stage.innerHTML = `
        <div style="width:100%;font-family:var(--sans)">
          <div style="font-size:13px;font-weight:600;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.06em;color:#0C1E3D">Card details</div>
          <label style="font-size:11px;color:#5a6577;display:block;margin-bottom:6px">Card number</label>
          <div id="mh-card-number" style="height:48px;border:1px solid #d9dee6;margin-bottom:16px;padding:0 12px;background:#fff"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">
            <div><label style="font-size:11px;color:#5a6577;display:block;margin-bottom:6px">Exp. month</label>
              <div id="mh-card-exp-month" style="height:48px;border:1px solid #d9dee6;padding:0 12px;background:#fff"></div></div>
            <div><label style="font-size:11px;color:#5a6577;display:block;margin-bottom:6px">Exp. year</label>
              <div id="mh-card-exp-year" style="height:48px;border:1px solid #d9dee6;padding:0 12px;background:#fff"></div></div>
            <div><label style="font-size:11px;color:#5a6577;display:block;margin-bottom:6px">CVV</label>
              <div id="mh-card-cvv" style="height:48px;border:1px solid #d9dee6;padding:0 12px;background:#fff"></div></div>
          </div>
          <label style="font-size:11px;color:#5a6577;display:block;margin-bottom:6px">Card holder name (optional)</label>
          <div id="mh-card-holder" style="height:48px;border:1px solid #d9dee6;margin-bottom:20px;padding:0 12px;background:#fff"></div>
          <button id="mh-pay-btn" style="width:100%;padding:14px;border:1px solid #0C1E3D;background:#0C1E3D;color:#fff;font-weight:600;font-size:14px;cursor:pointer">Pay now</button>
          <div id="rendered-url-iframe-container" style="margin-top:20px"></div>
        </div>`;

      add("sdk-call", "SDK: elements() + create card fields", {
        fields: ["cardNumber", "cardExpiryMonth", "cardExpiryYear", "cardCvv", "cardHolderName"],
      });
      const elements = mh.elements({ styles: { fontSize: "14px", padding: "10px" } });
      const mk = (elementType: string, selector: string, placeholder: string) => {
        const el = elements.create({ elementType, elementOptions: { selector, placeholder } });
        el.mount();
      };
      mk("cardNumber", "#mh-card-number", "1234 5678 9012 3456");
      mk("cardExpiryMonth", "#mh-card-exp-month", "MM");
      mk("cardExpiryYear", "#mh-card-exp-year", "YY");
      mk("cardCvv", "#mh-card-cvv", "123");
      mk("cardHolderName", "#mh-card-holder", "Name on card");

      // Attach via event delegation on the stage container so the handler
      // fires regardless of when the button element is (re)created or if the
      // SDK's field mounting re-touches the DOM. A direct onclick can silently
      // fail to attach if the query runs at the wrong moment.
      let paying = false;
      const onStageClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        if (!target || !target.closest("#mh-pay-btn")) return;
        if (paying) return;
        paying = true;
        add("info", "Pay button clicked — collecting card data…");
        const btn = stage.querySelector("#mh-pay-btn") as HTMLButtonElement | null;
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Processing…";
        }
        try {
          const saveCard = config.scenarioId === "save-card";
          applyIntentSecret(mh);

          // Billing from the config (SDK ignores fields the schema doesn't ask
          // for). Repo passes billingData straight into cardForm.pay.
          const cfgB = (config.billing ?? {}) as unknown as Record<string, string>;
          const billingData: Record<string, string> = {};
          for (const [k, v] of Object.entries(cfgB)) {
            if (v && String(v).trim()) billingData[k] = String(v).trim();
          }

          // Repo card flow: collect() → cardForm.pay({ cardData, intentId, billingData }).
          add("sdk-call", "SDK: cardForm.collect()");
          const cardData = await mh.cardForm.collect();
          add("response", "SDK: card data collected", cardData);

          add("sdk-call", "SDK: cardForm.pay({ cardData, intentId, billingData?, saveCard })", {
            intentId,
            billingData,
            saveCard,
          });
          const t1 = performance.now();
          let details = await mh.cardForm.pay({
            cardData,
            intentId,
            billingData: Object.keys(billingData).length ? billingData : undefined,
            saveCard,
          });
          add("response", "SDK: cardForm.pay resolved", details, {
            durationMs: Math.round(performance.now() - t1),
          });

          // Drive remaining states (URL_TO_RENDER/3DS, PROCESSING, terminal).
          details = await handleState(mh, details);
          const oc = outcomeForState(details.state);
          if (oc) finish(oc);
        } catch (err) {
          add("error", "Card payment failed.", err);
          const btn2 = stage.querySelector("#mh-pay-btn") as HTMLButtonElement | null;
          if (btn2) { btn2.disabled = false; btn2.textContent = "Pay now"; }
        } finally {
          paying = false;
        }
      };
      stage.addEventListener("click", onStageClick);
    },
    [add, handleState, applyIntentSecret, finish],
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
        setMethods(flattenMethods(res)); setExpressMethods(extractExpress(res));
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
      // Repo model: create the intent WITH the selected payment_method.
      const created = await createIntent(config, body, baseURL, selectedMethodId);
      if (!created) {
        setBusy(false);
        return;
      }
      applyIntentSecret(mh);

      const sel = selectedMethodRef.current;
      if (selectedMethodId === "CARD" && (!sel || sel.kind === "method")) {
        // Intent created with payment_method=CARD → it's in FORM_FIELDS.
        // Render the card fields; the pay button does collect()+cardForm.pay().
        await renderCardAndPay(mh, config, created.intentId);
      } else if (sel) {
        // Non-card: fetch intent details and drive the state machine
        // (URL_TO_RENDER for redirect methods like Tabby/Tamara, etc.).
        try {
          add("sdk-call", "SDK: getIntentDetails(intentId)", { intentId: created.intentId });
          const details = await mh.getIntentDetails(created.intentId);
          add("response", "SDK: intent details", details);
          const final = await handleState(mh, details);
          const oc = outcomeForState(final.state);
          if (oc) finish(oc);
        } catch (err) {
          add("error", "Could not drive the payment state.", err);
        }
      } else {
        add("error", "No method selected.");
      }
      setBusy(false);
    },
    [
      add,
      selectedMethodId,
      parsePayload,
      createIntent,
      applyIntentSecret,
      renderCardAndPay,
      handleState,
      finish,
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
      applyIntentSecret(mh);
      add("sdk-call", "SDK: getMethods({ intentId })", {
        intentId: created.intentId,
      });
      try {
        const t0 = performance.now();
        const res = await mh.getMethods({ intentId: created.intentId });
        add("response", "SDK: methods returned", res, {
          durationMs: Math.round(performance.now() - t0),
        });
        setMethods(flattenMethods(res)); setExpressMethods(extractExpress(res));
        setPhase("methods-shown");
      } catch (err) {
        add("error", "getMethods failed.", err);
      }
      setBusy(false);
    },
    [add, reset, parsePayload, createIntent, buildSdk],
  );

  // Called when a method is picked (intent-first: intent already exists → pay).
  // Proceed with a non-card method: map its bucket to the proceedWith type.

  const selectMethod = useCallback(
    async (method: MethodLike) => {
      const methodId = method.id;
      setSelectedMethodId(methodId);
      selectedMethodRef.current = method;
      const config = configRef.current;
      const mh = mhRef.current;
      if (!config || !mh) return;

      // Intent-first: intent already exists → proceedWith to select the method.
      if (config.methodTiming === "intent-first" && intentIdRef.current) {
        setBusy(true);
        setPhase("running");
        const intentId = intentIdRef.current;
        applyIntentSecret(mh);
        try {
          add("sdk-call", `SDK: proceedWith({ intentId, type:'method', id:'${methodId}' })`, { intentId });
          const details = await mh.proceedWith({ intentId, type: "method", id: methodId });
          add("response", "SDK: proceedWith returned", details);

          if (methodId === "CARD" && method.kind === "method") {
            // Now in FORM_FIELDS → render card fields; button does collect+pay.
            await renderCardAndPay(mh, config, intentId);
          } else {
            const final = await handleState(mh, details);
            const oc = outcomeForState(final.state);
            if (oc) finish(oc);
          }
        } catch (err) {
          add("error", "proceedWith failed.", err);
        }
        setBusy(false);
      }
      // Methods-first: just record the selection; user clicks "Pay" next.
    },
    [add, renderCardAndPay, applyIntentSecret, handleState, finish],
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
    clearLog,
    expressMethods,
    submitNativeReceipt,
    validateApplePay,
    logInfo,
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

  // Billing / shipping — only include fields the user filled in.
  const nonEmpty = (c: Record<string, string>) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(c)) if (v && v.trim()) out[k] = v.trim();
    return out;
  };
  const billing = nonEmpty(config.billing as unknown as Record<string, string>);
  if (Object.keys(billing).length && body.billing_data === undefined) {
    body.billing_data = billing;
  }
  const shippingSrc = config.shippingSameAsBilling
    ? config.billing
    : config.shipping;
  const shipping = nonEmpty(shippingSrc as unknown as Record<string, string>);
  if (Object.keys(shipping).length && body.shipping_data === undefined) {
    body.shipping_data = shipping;
  }
}
