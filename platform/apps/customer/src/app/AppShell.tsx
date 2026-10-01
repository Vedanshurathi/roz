import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useI18n } from '@rozbazaar/web';
import { api } from '../api/client';
import { useSession } from '../api/queries';
import { useSyncPush } from '../features/notifications/PushAlerts';

const NAV_ROUTES = ['/', '/orders', '/account'];

export function AppShell() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const showNav = NAV_ROUTES.includes(pathname);

  useSyncPush(Boolean(useSession().data?.authenticated));
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    // One anonymous visit ping per browser session (traffic stats in the admin console).
    try {
      if (!sessionStorage.getItem('rbx.visit')) {
        sessionStorage.setItem('rbx.visit', '1');
        void api.post('/v1/public/visits', { page: 'home' }).catch(() => undefined);
      }
    } catch {
      /* storage blocked */
    }
  }, []);

  return (
    <div className={`app ${showNav ? 'app--nav' : ''}`}>
      <main id="main">
        <Outlet />
      </main>
      {showNav ? (
        <nav className="bnav" aria-label={t('Main', 'मुख्य')}>
          <NavLink to="/" end className="bnav__i">
            <span aria-hidden>🏠</span>
            {t('Home', 'होम')}
          </NavLink>
          <NavLink to="/orders" className="bnav__i">
            <span aria-hidden>📦</span>
            {t('Orders', 'ऑर्डर')}
          </NavLink>
          <NavLink to="/account" className="bnav__i">
            <span aria-hidden>👤</span>
            {t('Account', 'खाता')}
          </NavLink>
        </nav>
      ) : null}
    </div>
  );
}
