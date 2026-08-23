"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResultInner() {
  const params = useSearchParams();
  const router = useRouter();

  // MoneyHash appends these to the redirect URL.
  const status = (params.get("status") || "").toUpperCase();
  const type = params.get("type") || "";
  const intentId = params.get("intent_id") || params.get("intentId") || "";
  const amount = params.get("amount") || "";
  const currency = params.get("currency") || "";

  // Decide outcome from the status/type MoneyHash sends.
  let kind: "success" | "failed" | "cancelled" | "pending" = "pending";
  if (/SUCCESS/.test(status) || /successful/i.test(type)) kind = "success";
  else if (/FAIL|DECLIN/.test(status) || /fail/i.test(type)) kind = "failed";
  else if (/CLOSE|CANCEL|EXPIRE/.test(status) || /close|cancel|expire/i.test(type))
    kind = "cancelled";

  const meta = {
    success: { title: "Payment successful", color: "var(--ok)", icon: "✓" },
    failed: { title: "Payment failed", color: "var(--bad)", icon: "✕" },
    cancelled: { title: "Payment cancelled", color: "var(--warn)", icon: "—" },
    pending: { title: "Payment pending", color: "var(--warn)", icon: "…" },
  }[kind];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--white)",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--edge)",
          borderRadius: 16,
          padding: "40px 36px",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            color: "#fff",
            background: meta.color,
          }}
        >
          {meta.icon}
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
          {meta.title}
        </h1>
        {(amount || intentId) && (
          <p
            className="mono"
            style={{
              margin: "0 0 24px",
              fontSize: 12.5,
              color: "var(--text-soft)",
              lineHeight: 1.6,
            }}
          >
            {amount && (
              <>
                Amount: {amount} {currency}
                <br />
              </>
            )}
            {intentId && <>Intent: {intentId}</>}
          </p>
        )}
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "11px 20px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 9,
            border: "none",
            background: "var(--navy)",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Back to shop
        </button>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultInner />
    </Suspense>
  );
}
