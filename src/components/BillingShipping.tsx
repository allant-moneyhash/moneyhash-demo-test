"use client";

import { ContactDetails } from "@/lib/types";

const label: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--text-soft)",
  marginBottom: 4,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid var(--edge)",
  background: "#fff",
  fontSize: 12.5,
  color: "var(--text)",
};

const FIELDS: { key: keyof ContactDetails; label: string; half?: boolean }[] = [
  { key: "first_name", label: "First name", half: true },
  { key: "last_name", label: "Last name", half: true },
  { key: "email", label: "Email", half: true },
  { key: "phone_number", label: "Phone number", half: true },
  { key: "address", label: "Address" },
  { key: "city", label: "City", half: true },
  { key: "state", label: "State", half: true },
  { key: "country", label: "Country (ISO-2, e.g. AE)", half: true },
  { key: "postal_code", label: "Postal code", half: true },
];

function ContactForm({
  value,
  onChange,
}: {
  value: ContactDetails;
  onChange: (patch: Partial<ContactDetails>) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {FIELDS.map((f) => (
        <div key={f.key} style={{ gridColumn: f.half ? "auto" : "1 / -1" }}>
          <label style={label}>{f.label}</label>
          <input
            style={input}
            value={value[f.key]}
            onChange={(e) => onChange({ [f.key]: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ))}
    </div>
  );
}

export default function BillingShipping({
  billing,
  shipping,
  sameAsBilling,
  onBillingChange,
  onShippingChange,
  onSameToggle,
}: {
  billing: ContactDetails;
  shipping: ContactDetails;
  sameAsBilling: boolean;
  onBillingChange: (patch: Partial<ContactDetails>) => void;
  onShippingChange: (patch: Partial<ContactDetails>) => void;
  onSameToggle: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--navy)",
            marginBottom: 12,
          }}
        >
          Billing details
        </div>
        <ContactForm value={billing} onChange={onBillingChange} />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--navy)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={sameAsBilling}
          onChange={(e) => onSameToggle(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--navy)" }}
        />
        Shipping address same as billing
      </label>

      {!sameAsBilling && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--navy)",
              marginBottom: 12,
            }}
          >
            Shipping details
          </div>
          <ContactForm value={shipping} onChange={onShippingChange} />
        </div>
      )}
    </div>
  );
}
