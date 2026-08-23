"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PRODUCTS, QUICK_CURRENCIES } from "@/lib/defaults";
import Header from "@/components/Header";

const qtyBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  border: "1px solid var(--edge-strong)",
  background: "#fff",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  color: "var(--navy)",
};

export default function Storefront() {
  const router = useRouter();
  const { currency, setCurrency, cart, addToCart, removeFromCart, cartCount, setStep } =
    useStore();

  const fmt = (n: number) => `${currency} ${n.toLocaleString()}`;
  const total = cart.reduce(
    (sum, i) => sum + (i.product.price[currency] ?? 0) * i.quantity,
    0,
  );

  function goCheckout() {
    setStep(2);
    router.push("/checkout");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--white)" }}>
      <Header step={1} />

      {/* Currency selector row */}
      <div
        style={{
          borderBottom: "1px solid var(--edge)",
          padding: "10px 32px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--surface)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Currency</span>
        <div style={{ display: "flex", gap: 0 }}>
          {QUICK_CURRENCIES.map((cur) => {
            const active = currency === cur;
            return (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className="mono"
                style={{
                  padding: "6px 13px",
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid var(--edge-strong)",
                  borderLeft: "none",
                  background: active ? "var(--navy)" : "#fff",
                  color: active ? "#fff" : "var(--text-soft)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {cur}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "44px 32px",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: 44,
          alignItems: "start",
        }}
      >
        {/* Products */}
        <div>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: 24,
              fontWeight: 700,
              color: "var(--navy)",
              letterSpacing: "-0.01em",
            }}
          >
            Shop the collection
          </h1>
          <p
            style={{
              margin: "0 0 32px",
              color: "var(--text-soft)",
              fontSize: 14,
            }}
          >
            Add items and proceed to checkout to see the full payment flow.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 0,
              border: "1px solid var(--edge)",
              borderRight: "none",
              borderBottom: "none",
            }}
          >
            {PRODUCTS.map((p) => {
              const inCart = cart.find((i) => i.product.id === p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    borderRight: "1px solid var(--edge)",
                    borderBottom: "1px solid var(--edge)",
                    background: "#fff",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Flat monochrome product block */}
                  <div
                    style={{
                      height: 150,
                      background: "var(--surface)",
                      borderBottom: "1px solid var(--edge)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--edge-strong)",
                        fontWeight: 600,
                      }}
                    >
                      {p.name.split(" ")[0]}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 4px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--navy)",
                      }}
                    >
                      {p.name}
                    </h3>
                    <p
                      style={{
                        margin: "0 0 16px",
                        fontSize: 12.5,
                        color: "var(--text-soft)",
                        lineHeight: 1.45,
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
                      <span
                        className="mono"
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--navy)",
                        }}
                      >
                        {fmt(p.price[currency] ?? 0)}
                      </span>
                      {inCart ? (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0,
                          }}
                        >
                          <button
                            onClick={() => removeFromCart(p.id)}
                            style={qtyBtn}
                            aria-label={`Remove one ${p.name}`}
                          >
                            −
                          </button>
                          <span
                            className="mono"
                            style={{
                              minWidth: 34,
                              textAlign: "center",
                              fontSize: 13,
                              borderTop: "1px solid var(--edge-strong)",
                              borderBottom: "1px solid var(--edge-strong)",
                              height: 30,
                              lineHeight: "30px",
                            }}
                          >
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => addToCart(p)}
                            style={qtyBtn}
                            aria-label={`Add one ${p.name}`}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          style={{
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "1px solid var(--navy)",
                            background: "var(--navy)",
                            color: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <aside
          style={{
            border: "1px solid var(--edge)",
            background: "#fff",
            position: "sticky",
            top: 44,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--edge)",
              background: "var(--surface)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--navy)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Cart {cartCount > 0 && `(${cartCount})`}
            </h2>
          </div>

          <div style={{ padding: 20 }}>
            {cart.length === 0 ? (
              <p style={{ color: "var(--text-soft)", fontSize: 13, margin: 0 }}>
                Nothing here yet. Add a product to get started.
              </p>
            ) : (
              <>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 14 }}
                >
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
                        <div style={{ fontWeight: 500, color: "var(--navy)" }}>
                          {i.product.name}
                        </div>
                        <div
                          className="mono"
                          style={{ fontSize: 11.5, color: "var(--text-soft)" }}
                        >
                          {fmt(i.product.price[currency] ?? 0)} × {i.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    borderTop: "1px solid var(--edge)",
                    marginTop: 18,
                    paddingTop: 16,
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--navy)",
                  }}
                >
                  <span>Total</span>
                  <span className="mono">{fmt(total)}</span>
                </div>

                <button
                  onClick={goCheckout}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    padding: "13px",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "1px solid var(--navy)",
                    background: "var(--navy)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Proceed to checkout
                </button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
