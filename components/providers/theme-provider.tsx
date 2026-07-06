"use client";

import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import { deriveThemeTokens } from "@/lib/theme";

const LS_KEY = "flowzen_companyColor";

function getPersistedColor(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const tokens = useMemo(() => {
    const cached = getPersistedColor();
    const color = cached || session?.user?.companyColor;
    if (!color) return null;
    return deriveThemeTokens(color);
  }, [session?.user?.companyColor]);

  useEffect(() => {
    if (!tokens) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(tokens)) {
      root.style.setProperty(`--color-${key}`, value);
    }
  }, [tokens]);

  return <>{children}</>;
}
