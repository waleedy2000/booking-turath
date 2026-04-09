"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/branding/Logo";

export default function SplashScreen({
  onFinish,
}: {
  onFinish: () => void;
}) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fading out after 1500ms
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 1500);

    // Call finish after transition ends (500ms after fade starts)
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`
      fixed inset-0 z-[9999]
      flex items-center justify-center
      bg-white dark:bg-[#0a0a0a]
      transition-opacity duration-500 ease-in-out
      ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}
    `}>
      <div className="flex flex-col items-center gap-6">

        {/* Logo with custom animation */}
        <div className="relative">
          <div className="absolute inset-0 bg-[#097834] blur-2xl opacity-20 rounded-full animate-pulse"></div>
          <Logo variant="icon" priority className="w-24 h-24 object-contain relative z-10 animate-[pulse_1.5s_ease-in-out_infinite]" />
        </div>

        {/* Text */}
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 tracking-wider">
          جاري التحميل...
        </p>

      </div>
    </div>
  );
}
