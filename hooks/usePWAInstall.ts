"use client";

import { useEffect, useState } from "react";

export default function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Detect if already installed (standalone mode)
    const checkStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Delay prompt presentation to 8 seconds to let user understand product first
    // This raises adoption and reduces bounce rate
    const showTimer = setTimeout(() => {
      setShowInstallPrompt(true);
    }, 8000);

    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setPrompt(null);
      setInstalled(true);
      setTimeout(() => setInstalled(false), 6000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  return {
    install,
    isInstallable: !!prompt,
    isIOS,
    isStandalone,
    installed,
    showInstallPrompt,
  };
}
