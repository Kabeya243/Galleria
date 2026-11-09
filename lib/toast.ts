// Minimal app-wide success toast: any client code calls showToast
// and the mounted <LakisaToast /> (app/layout.tsx) shows the message
// for a few seconds, then dismisses it. No state to wire through
// props, no dependency.
export function showToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("lakisa:toast", { detail: { message } }));
}
