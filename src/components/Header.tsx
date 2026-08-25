"use client";

const STEPS = ["Shop", "Setup", "Scenario", "Run"];

export default function Header({
  step,
  onStepClick,
}: {
  step?: number;
  onStepClick?: (n: number) => void;
}) {
  return (
    <header
      style={{
        background: "#fff",
        borderBottom: "1px solid var(--edge)",
        height: 64,
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        gap: 28,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/moneyhash-logo.png" alt="MoneyHash" style={{ height: 34 }} />
      <span
        className="mono"
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--navy)",
          background: "var(--accent)",
          border: "1px solid var(--accent-line)",
          padding: "2px 7px",
        }}
      >
        v21
      </span>

      {step !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginLeft: 8 }}>
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const done = n < step;
            const clickable = onStepClick && n <= step;
            return (
              <div key={label} style={{ display: "flex", alignItems: "center" }}>
                <button
                  onClick={() => clickable && onStepClick!(n)}
                  disabled={!clickable}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "transparent",
                    border: "none",
                    cursor: clickable ? "pointer" : "default",
                    padding: "6px 4px",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      background: active
                        ? "var(--navy)"
                        : done
                          ? "var(--accent)"
                          : "var(--surface)",
                      color: active
                        ? "#fff"
                        : done
                          ? "var(--navy)"
                          : "var(--text-soft)",
                      border: "1px solid var(--edge-strong)",
                    }}
                  >
                    {n}
                  </span>
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: active ? 700 : 500,
                      color: active ? "var(--navy)" : "var(--text-soft)",
                    }}
                  >
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span
                    style={{
                      width: 26,
                      height: 1,
                      background: "var(--edge-strong)",
                      margin: "0 6px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
}
