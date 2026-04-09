"use client";

import { useEffect, useState } from "react";

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    
    // Check local storage or system preference
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.toggle("dark", true);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";

    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <>
      {children}
      {/* Global toggle button */}
      <button
        onClick={toggleTheme}
        className="fixed bottom-4 left-4 z-[9999] p-3 shadow-xl backdrop-blur-md bg-white border border-gray-200 text-gray-800 dark:bg-[#1a1a1a] dark:text-gray-200 dark:border-gray-800 rounded-full transition-transform hover:scale-110 active:scale-95 flex items-center justify-center gap-2"
        title="تبديل المظهر"
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </>
  );
}
