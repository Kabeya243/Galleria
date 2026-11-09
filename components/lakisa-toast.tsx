// App-wide success toast (lib/toast.ts): listens for `lakisa:toast`
// events and shows the message bottom-centre for a few seconds.
// Mounted once in app/layout.tsx.
"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import "./lakisa-toast.css";

export default function LakisaToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      if (!detail?.message) return;
      setMessage(detail.message);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setMessage(null), 4500);
    };
    window.addEventListener("lakisa:toast", onToast);
    return () => {
      window.removeEventListener("lakisa:toast", onToast);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!message) return null;
  return (
    <div className="lakisa-toast" role="status" aria-live="polite">
      <Check size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
