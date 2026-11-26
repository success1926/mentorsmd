import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

// Short-lived pieces of the screen: a toast and a bottom sheet. One copy,
// in the root layout (components/ui.tsx Overlays draws them).
type OverlayCtx = {
  toast: (msg: string) => void;
  toastMsg: string | null;
  sheet: SheetBody | null;
  openSheet: (body: SheetBody) => void;
  closeSheet: () => void;
};
// A sheet's content is a small component, so it re-renders when the data it shows changes.
export type SheetBody = () => ReactNode;
const OverlayContext = createContext<OverlayCtx | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetBody | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const openSheet = useCallback((body: SheetBody) => setSheet(() => body), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const value = useMemo(() => ({ toast, toastMsg, sheet, openSheet, closeSheet }), [toast, toastMsg, sheet, openSheet, closeSheet]);
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay() {
  const c = useContext(OverlayContext);
  if (!c) throw new Error("useOverlay outside OverlayProvider");
  return c;
}
