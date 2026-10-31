import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type Tone = 'info' | 'good' | 'bad';
interface ToastApi {
  show(message: string, tone?: Tone): void;
}
const Ctx = createContext<ToastApi>({ show: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: Tone } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((message: string, tone: Tone = 'info') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="rb-toast-zone" aria-live="polite" role="status">
        {toast ? (
          <div key={toast.id} className={`rb-toast rb-toast--${toast.tone}`}>
            {toast.message}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
