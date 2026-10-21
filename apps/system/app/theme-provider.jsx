"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children }) {
    return (<NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange storageKey="fama-system-theme-v2">
      {children}
    </NextThemesProvider>);
}
