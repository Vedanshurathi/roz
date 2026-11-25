import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/** The original app's single toast at the bottom (`.toast.show`). */
const Ctx = createContext<(msg: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [on, setOn] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    setOn(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOn(false), 1900);
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast ${on ? 'show' : ''}`} role="status" aria-live="polite">
        {msg}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
