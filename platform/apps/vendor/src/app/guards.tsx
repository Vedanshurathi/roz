import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState, Spinner, useI18n } from '@rozbazaar/web';
import { useSession } from '../api/queries';
import { OrderAlerts } from './OrderAlerts';
import { VendorContext } from './vendor-context';

function useGate() {
  const session = useSession();
  const loc = useLocation();
  const toLogin = <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return { session, toLogin };
}

/** Logged in (maybe not a vendor yet — e.g. just back from Google to register). */
export function RequireAccount() {
  const { t } = useI18n();
  const { session, toLogin } = useGate();
  if (session.isPending) return <Spinner />;
  if (session.isError)
    return (
      <ErrorState
        message={session.error.message}
        onRetry={() => session.refetch()}
        retryLabel={t('Retry', 'फिर से')}
      />
    );
  if (!session.data.authenticated) return toLogin;
  return <Outlet />;
}

/** A vendor account. Signed-in people without one are sent to finish registration. */
export function RequireVendor() {
  const { t } = useI18n();
  const { session, toLogin } = useGate();
  if (session.isPending) return <Spinner />;
  if (session.isError)
    return (
      <ErrorState
        message={session.error.message}
        onRetry={() => session.refetch()}
        retryLabel={t('Retry', 'फिर से')}
      />
    );
  if (!session.data.authenticated) return toLogin;
  if (!session.data.user) return <Navigate to="/register" replace />;
  return (
    <VendorContext.Provider value={session.data.user}>
      <OrderAlerts />
      <Outlet />
    </VendorContext.Provider>
  );
}
