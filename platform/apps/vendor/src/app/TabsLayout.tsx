import { NavLink, Outlet } from 'react-router';
import { useI18n } from '@rozbazaar/web';

const TABS = [
  { to: '/', icon: '🏠', en: 'Today', hi: 'आज' },
  { to: '/stock', icon: '🥬', en: 'Stock', hi: 'स्टॉक' },
  { to: '/slots', icon: '🕖', en: 'Slots', hi: 'स्लॉट' },
  { to: '/dashboard', icon: '📊', en: 'Dashboard', hi: 'डैशबोर्ड' },
] as const;

/** The four main tabs share the bottom nav; order steps are full-screen without it. */
export function TabsLayout() {
  const { t } = useI18n();
  return (
    <div className="shell">
      <main className="shell__main">
        <Outlet />
      </main>
      <nav className="bnav" aria-label={t('Main', 'मुख्य')}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) => `bnav__i ${isActive ? 'is-on' : ''}`}
          >
            <span aria-hidden>{tab.icon}</span>
            <small>{t(tab.en, tab.hi)}</small>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
