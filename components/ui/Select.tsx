"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps {
  options: Option[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = "اختر",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative w-full mb-3" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="
          w-full flex items-center justify-between
          px-4 py-3 rounded-xl border
          bg-white dark:bg-gray-900
          border-gray-300 dark:border-gray-700
          text-right
          text-black dark:text-white
          focus:outline-none
          focus:ring-2 focus:ring-green-600/30
          transition
        "
      >
        <span className="text-sm font-semibold">
          {selected?.label || placeholder}
        </span>

        <ChevronDown className={`w-4 h-4 opacity-60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border 
          bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm
          border-gray-200 dark:border-gray-700
          shadow-2xl p-1 max-h-60 overflow-y-auto animate-fade-in custom-scrollbar">

          {options.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400 font-semibold text-center">
              لا توجد خيارات
            </div>
          )}

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`
                w-full flex items-center justify-between px-4 py-2.5 text-sm rounded-xl
                transition-all duration-200 ease-in-out
                border border-transparent
                focus:outline-none focus:bg-green-100 dark:focus:bg-green-900/40
                ${
                  value === option.value
                    ? "bg-green-200/70 dark:bg-green-800/40 text-green-900 dark:text-green-300 font-semibold shadow-sm"
                    : "hover:bg-black/5 dark:hover:bg-white/5 hover:pr-6 text-gray-700 dark:text-gray-300 font-semibold"
                }
              `}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-green-700 dark:text-green-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
