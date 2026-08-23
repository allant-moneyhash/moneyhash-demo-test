"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { CartItem, DemoConfig, Product } from "./types";
import { DEFAULT_CONFIG } from "./defaults";

interface Store {
  currency: string;
  setCurrency: (c: string) => void;
  cart: CartItem[];
  addToCart: (p: Product) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartCount: number;
  config: DemoConfig;
  setConfig: (patch: Partial<DemoConfig>) => void;
  step: number;
  setStep: (n: number) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState("AED");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [config, setConfigState] = useState<DemoConfig>(DEFAULT_CONFIG);
  const [step, setStep] = useState(1);

  const addToCart = useCallback((p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.product.id === id ? { ...i, quantity: i.quantity - 1 } : i,
        );
      }
      return prev.filter((i) => i.product.id !== id);
    });
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const setConfig = useCallback((patch: Partial<DemoConfig>) => {
    setConfigState((c) => ({ ...c, ...patch }));
  }, []);

  const cartCount = cart.reduce((n, i) => n + i.quantity, 0);

  return (
    <StoreContext.Provider
      value={{
        currency,
        setCurrency,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartCount,
        config,
        setConfig,
        step,
        setStep,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
