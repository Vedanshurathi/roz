import { lazy, Suspense, useCallback } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, Spinner, ToastProvider } from '@rozbazaar/web';
import type { Lang } from '@rozbazaar/shared';
import { api, queryClient } from '../api/client';
import { useSession } from '../api/queries';
import { STORAGE } from '../config';
import { ShopProvider } from '../state/shop';
import { AppShell } from './AppShell';

// Each screen is its own chunk, so the first load on a village 4G connection stays small.
const HomePage = lazy(() => import('../features/catalog/HomePage'));
const BasketPage = lazy(() => import('../features/basket/BasketPage'));
const SlotPage = lazy(() => import('../features/checkout/SlotPage'));
const CheckoutPage = lazy(() => import('../features/checkout/CheckoutPage'));
const SuccessPage = lazy(() => import('../features/checkout/SuccessPage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const AddressPage = lazy(() => import('../features/addresses/AddressPage'));
const OrdersPage = lazy(() => import('../features/orders/OrdersPage'));
const AccountPage = lazy(() => import('../features/account/AccountPage'));

/** Pages that need a customer session send people to login and back. */
function RequireLogin() {
  const session = useSession();
  const loc = useLocation();
  if (session.isPending) return <Spinner />;
  if (!session.data?.authenticated)
    return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

const page = (el: React.ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: page(<HomePage />) },
      { path: '/basket', element: page(<BasketPage />) },
      { path: '/slot', element: page(<SlotPage />) },
      { path: '/login', element: page(<LoginPage />) },
      { path: '/account', element: page(<AccountPage />) },
      {
        element: <RequireLogin />,
        children: [
          { path: '/checkout', element: page(<CheckoutPage />) },
          { path: '/success', element: page(<SuccessPage />) },
          { path: '/orders', element: page(<OrdersPage />) },
          { path: '/address/new', element: page(<AddressPage />) },
          { path: '/address/:id', element: page(<AddressPage />) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  // Keep the account's language in sync so push notifications arrive in the same language.
  const onLang = useCallback((l: Lang) => {
    const s = queryClient.getQueryData<{ authenticated: boolean }>(['session']);
    if (s?.authenticated) void api.put('/v1/customer/language', { lang: l }).catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider storageKey={STORAGE.lang} defaultLang="en" onChange={onLang}>
        <ToastProvider>
          <ShopProvider>
            <RouterProvider router={router} />
          </ShopProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
