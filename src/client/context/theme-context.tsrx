import { createContext, useContext, createSignal, createEffect, JSX } from "solid-js";
import { syncUserPreferences } from "~/server/helpers/user-sync";

const getInitialTheme = () => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
};

export const applyTheme = (t: string) => {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  if (t === "dark") {
    html.classList.add("dark");
    html.classList.remove("light");
  } else {
    html.classList.add("light");
    html.classList.remove("dark");
  }
};

interface ThemeContextType {
  theme: () => string;
  setTheme: (t: string) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>();

export function ThemeProvider(props: { children: JSX.Element }) {
  const [themeState, setThemeState] = createSignal(getInitialTheme());

  const setTheme = (t: string) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
    syncUserPreferences({ theme: t });
  };

  const toggleTheme = () => {
    const next =
      themeState() === "dark" ? "light" : "dark";
    setTheme(next);
  };

  createEffect(() => {
    applyTheme(themeState());
  });

  if (typeof window !== "undefined") {
    window.addEventListener("theme_updated", () => {
      const saved = localStorage.getItem("theme");
      if (saved && (saved === "dark" || saved === "light")) {
        setThemeState(saved);
        applyTheme(saved);
      }
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        const next = e.matches ? "dark" : "light";
        setThemeState(next);
        applyTheme(next);
      }
    });
  }

  return <tsx>
    <ThemeContext.Provider value={{ theme: themeState, setTheme, toggleTheme }}>
      {props.children}
    </ThemeContext.Provider>
  </tsx>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
