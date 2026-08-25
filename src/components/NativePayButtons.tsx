"use client";

import { useEffect, useRef } from "react";

interface NativePayData {
  currency_code: string;
  country_code: string | null;
  amount: number;
  gateway: string;
  gateway_merchant_id: string;
  merchant_name: string;
  merchant_id: string;
  method_id: string;
  allowed_card_networks: string[];
  allowed_card_auth_methods: string[];
  supported_networks?: string[];
}

interface ExpressMethod {
  id: string;
  title: string;
  nativePayData?: NativePayData | null;
}

export default function NativePayButtons({
  express,
  environment,
  onGoogleToken,
  onAppleReceipt,
  onValidateApple,
  onLog,
}: {
  express: ExpressMethod[];
  environment: "sandbox" | "production";
  onGoogleToken: (receipt: Record<string, unknown>) => void;
  onAppleReceipt: (receipt: Record<string, unknown>) => void;
  onValidateApple: (methodId: string, validationUrl: string) => Promise<unknown>;
  onLog?: (msg: string, body?: unknown) => void;
}) {
  const googleRef = useRef<HTMLDivElement>(null);
  const google = express.find((m) => m.id === "GOOGLE_PAY");
  const apple = express.find((m) => m.id === "APPLE_PAY");

  useEffect(() => {
    if (!google?.nativePayData || !googleRef.current) return;
    const data = google.nativePayData;
    let cancelled = false;
    onLog?.("Google Pay: loading button element", { nativePayData: data });

    import("@google-pay/button-element")
      .then(() => {
        if (cancelled || !googleRef.current) return;
        onLog?.("Google Pay: button element loaded, rendering");
        googleRef.current.innerHTML = "";

        const btn = document.createElement("google-pay-button") as HTMLElement & {
          paymentRequest?: unknown;
        };
        btn.setAttribute(
          "environment",
          environment === "production" ? "PRODUCTION" : "TEST",
        );
        btn.setAttribute("button-type", "pay");
        btn.setAttribute("button-color", "black");
        btn.setAttribute("button-size-mode", "fill");
        btn.style.width = "100%";

        (btn as unknown as { paymentRequest: unknown }).paymentRequest = {
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [
            {
              type: "CARD",
              parameters: {
                allowedAuthMethods: data.allowed_card_auth_methods,
                allowedCardNetworks: data.allowed_card_networks,
                billingAddressRequired: true,
              },
              tokenizationSpecification: {
                type: "PAYMENT_GATEWAY",
                parameters: {
                  gateway: data.gateway,
                  gatewayMerchantId: data.gateway_merchant_id,
                },
              },
            },
          ],
          merchantInfo: {
            merchantId: data.merchant_id,
            merchantName: data.merchant_name,
          },
          transactionInfo: {
            totalPriceStatus: "FINAL",
            totalPriceLabel: "Total",
            totalPrice: `${data.amount}`,
            currencyCode: data.currency_code,
            countryCode: data.country_code || "AE",
          },
          emailRequired: true,
        };

        btn.addEventListener("loadpaymentdata", (event: Event) => {
          const detail = (event as CustomEvent).detail;
          const token = detail?.paymentMethodData?.tokenizationData?.token;
          const email = detail?.email;
          onLog?.("Google Pay: token received");
          onGoogleToken({ receipt: token, receiptBillingData: { email } });
        });
        btn.addEventListener("cancel", () => onLog?.("Google Pay: sheet cancelled"));
        btn.addEventListener("readytopaychange", (e: Event) => {
          const ready = (e as CustomEvent).detail?.isReadyToPay;
          onLog?.(`Google Pay: isReadyToPay = ${ready}`);
        });

        googleRef.current.appendChild(btn);
      })
      .catch((err) => {
        onLog?.("Google Pay: failed to load button element", { error: String(err) });
        if (googleRef.current) {
          googleRef.current.innerHTML =
            '<div style="font-size:12px;color:#5a6577">Google Pay could not load in this browser.</div>';
        }
      });

    return () => {
      cancelled = true;
    };
  }, [google, environment, onGoogleToken, onLog]);

  const appleSupported =
    typeof window !== "undefined" &&
    // @ts-expect-error ApplePaySession is only on Safari
    typeof window.ApplePaySession !== "undefined" &&
    // @ts-expect-error ApplePaySession is only on Safari
    window.ApplePaySession?.canMakePayments?.();

  function startApplePay() {
    if (!apple?.nativePayData) return;
    const data = apple.nativePayData;
    onLog?.("Apple Pay: starting session");
    // @ts-expect-error Safari-only global
    const session = new window.ApplePaySession(3, {
      countryCode: data.country_code || "AE",
      currencyCode: data.currency_code,
      supportedNetworks: (data.supported_networks ||
        data.allowed_card_networks || ["visa", "masterCard"]) as string[],
      merchantCapabilities: ["supports3DS"],
      total: { label: data.merchant_name || "Total", type: "final", amount: `${data.amount}` },
      requiredShippingContactFields: ["email"],
    });
    session.onvalidatemerchant = (e: { validationURL: string }) => {
      onValidateApple(data.method_id, e.validationURL)
        .then((ms) => session.completeMerchantValidation(ms))
        .catch(() => session.completeMerchantValidation({}));
    };
    session.onpaymentauthorized = (e: {
      payment: { token: unknown; shippingContact?: { emailAddress?: string } };
    }) => {
      const receipt = {
        receipt: JSON.stringify({ token: e.payment.token }),
        receiptBillingData: { email: e.payment.shippingContact?.emailAddress },
      };
      // @ts-expect-error Safari-only constant
      session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
      onAppleReceipt(receipt);
    };
    session.begin();
  }

  if (!google && !apple) return null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {google?.nativePayData && (
          <div ref={googleRef} style={{ width: "100%", minHeight: 44 }} />
        )}
        {apple?.nativePayData && appleSupported && (
          <button
            onClick={startApplePay}
            aria-label="Pay with Apple Pay"
            style={{
              width: "100%", height: 44, background: "#000", color: "#fff",
              border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
             Pay
          </button>
        )}
        {apple?.nativePayData && !appleSupported && (
          <div style={{ fontSize: 11.5, color: "var(--text-soft)" }}>
            Apple Pay is available in Safari on Apple devices.
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px",
          color: "var(--text-soft)", fontSize: 12,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--edge)" }} />
        or pay another way
        <span style={{ flex: 1, height: 1, background: "var(--edge)" }} />
      </div>
    </div>
  );
}
