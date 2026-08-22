"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PRODUCTS, QUICK_CURRENCIES } from "@/lib/defaults";

export default function Storefront() {
  const router = useRouter();
  const {
    currency,
    setCurrency,
    cart,
    addToCart,
    removeFromCart,
    cartCount,
  } = useStore();

  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;
  const total = cart.reduce(
    (sum, i) => sum + (i.product.price[currency] ?? 0) * i.quantity,
    0,
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--paper-edge)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "#fff",
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
          The Demo Shop
        </span>
        <span
          className="mono"
          style={{ fontSize: 11, color: "var(--text-soft)" }}
        >
          powered by MoneyHash
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {QUICK_CURRENCIES.map((cur) => {
            const active = currency === cur;
            return (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className="mono"
                style={{
                  padding: "6px 11px",
                  fontSize: 12,
                  borderRadius: 7,
                  cursor: "pointer",
                  border: active
                    ? "1px solid var(--signal)"
                    : "1px solid var(--paper-edge)",
                  background: active ? "rgba(18,181,176,0.08)" : "#fff",
                  color: active ? "var(--signal-deep)" : "var(--text-soft)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {cur}
              </button>
            );
          })}
        </div>
      </header>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 40,
          alignItems: "start",
        }}
      >
        {/* Products */}
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700 }}>
            Shop the collection
          </h1>
          <p
            style={{
              margin: "0 0 28px",
              color: "var(--text-soft)",
              fontSize: 14,
            }}
          >
            Pick a few items and head to checkout to see the payment flow in
            action.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {PRODUCTS.map((p) => (
              <div
                key={p.id}
                style={{
                  border: "1px solid var(--paper-edge)",
                  borderRadius: 12,
                  background: "#fff",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    height: 140,
                    background:
                      "linear-gradient(135deg, #eef1f0 0%, #e3e8ee 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-soft)",
                    fontSize: 40,
                  }}
                >
                  {p.name.charAt(0)}
                </div>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>
                    {p.name}
                  </h3>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: 12.5,
                      color: "var(--text-soft)",
                      lineHeight: 1.4,
                      flex: 1,
                    }}
                  >
                    {p.blurb}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span className="mono" style={{ fontSize: 14, fontWeight: 600 }}>
                      {fmt(p.price[currency] ?? 0)}
                    </span>
                    <button
                      onClick={() => addToCart(p)}
                      style={{
                        padding: "7px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        borderRadius: 8,
                        border: "none",
                        background: "var(--signal)",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <aside
          style={{
            border: "1px solid var(--paper-edge)",
            borderRadius: 12,
            background: "#fff",
            padding: 20,
            position: "sticky",
            top: 40,
          }}
        >
          <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
            Your cart {cartCount > 0 && `(${cartCount})`}
          </h2>

          {cart.length === 0 ? (
            <p style={{ color: "var(--text-soft)", fontSize: 13 }}>
              Nothing here yet. Add a product to get started.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {cart.map((i) => (
                  <div
                    key={i.product.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{i.product.name}</div>
                      <div
                        className="mono"
                        style={{ fontSize: 11.5, color: "var(--text-soft)" }}
                      >
                        {fmt(i.product.price[currency] ?? 0)} × {i.quantity}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(i.product.id)}
                      style={{
                        border: "1px solid var(--paper-edge)",
                        background: "#fff",
                        borderRadius: 6,
                        width: 26,
                        height: 26,
                        cursor: "pointer",
                        color: "var(--text-soft)",
                      }}
                      aria-label={`Remove one ${i.product.name}`}
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--paper-edge)",
                  marginTop: 16,
                  paddingTop: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                <span>Total</span>
                <span className="mono">{fmt(total)}</span>
              </div>

              <button
                onClick={() => router.push("/checkout")}
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 9,
                  border: "none",
                  background: "var(--ink)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Proceed to checkout
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
