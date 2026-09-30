/**
 * English mode = proper English, Hindi mode = Devanagari. No Roman Hindi in either
 * (project rule since 26 Sep 2026). Every visible string goes through t(en, hi).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from '@rozbazaar/shared';
import { storage } from './storage.js';

interface I18n {
  lang: Lang;
  setLang(l: Lang): void;
  t(en: string, hi: string): string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider(props: {
  children: ReactNode;
  storageKey: string;
  defaultLang: Lang;
  onChange?: (l: Lang) => void;
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = storage.get<string>(props.storageKey);
    return saved === 'en' || saved === 'hi' ? saved : props.defaultLang;
  });
  const { onChange, storageKey } = props;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l);
      storage.set(storageKey, l);
      onChange?.(l);
    },
    [onChange, storageKey],
  );
  const t = useCallback((en: string, hi: string) => (lang === 'hi' ? hi : en), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
