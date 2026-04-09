"use client";

import { useState, useEffect } from "react";
import SplashScreen from "./SplashScreen";

export default function SplashWrapper({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    // Only show splash screen on cold start (new session)
    // This prevents the splash from rendering on every single page navigation
    if (sessionStorage.getItem('splashShown')) {
      setShow(false);
    }
  }, []);

  const handleFinish = () => {
    setShow(false);
    sessionStorage.setItem('splashShown', 'true');
  };

  return (
    <>
      {show && <SplashScreen onFinish={handleFinish} />}
      {children}
    </>
  );
}
