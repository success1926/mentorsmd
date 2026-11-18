import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { initialState, type DemoState } from "./sample";

// Who you're looking around as, and the sample data you change by tapping
// (approving a package, logging work, refunding...). Lives in memory only:
// reloading the app starts over.
export type Role = "student" | "mentor" | "admin";

type Ctx = {
  role: Role | null;
  setRole: (r: Role | null) => void;
  s: DemoState;
  change: (fn: (s: DemoState) => void) => void;
  reset: () => void;
};
const DemoCtx = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [s, setS] = useState<DemoState>(initialState);
  const change = useCallback((fn: (s: DemoState) => void) => {
    setS((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as DemoState;
      fn(next);
      return next;
    });
  }, []);
  const reset = useCallback(() => setS(initialState()), []);
  const value = useMemo(() => ({ role, setRole, s, change, reset }), [role, s, change, reset]);
  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}

export function useDemo() {
  const c = useContext(DemoCtx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}

// Short-lived pieces of the screen: a toast, a bottom sheet, the Face ID check.
type OverlayCtx = {
  toast: (msg: string) => void;
  toastMsg: string | null;
  sheet: SheetBody | null;
  openSheet: (body: SheetBody) => void;
  closeSheet: () => void;
  faceOn: boolean;
  faceId: (then: () => void) => void;
};
// A sheet's content is a small component, so it re-renders when the data it shows changes.
export type SheetBody = () => ReactNode;
const OverlayContext = createContext<OverlayCtx | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetBody | null>(null);
  const [faceOn, setFace] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  const openSheet = useCallback((body: SheetBody) => setSheet(() => body), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const faceId = useCallback((then: () => void) => {
    setFace(true);
    setTimeout(() => {
      setFace(false);
      then();
    }, 900);
  }, []);
  const value = useMemo(() => ({ toast, toastMsg, sheet, openSheet, closeSheet, faceOn, faceId }), [toast, toastMsg, sheet, openSheet, closeSheet, faceOn, faceId]);
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay() {
  const c = useContext(OverlayContext);
  if (!c) throw new Error("useOverlay outside OverlayProvider");
  return c;
}
