import { lazy, Suspense, useCallback } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { CrashScreen, I18nProvider, Spinner, ToastProvider } from '@rozbazaar/web';
import type { Lang } from '@rozbazaar/shared';
import { api, queryClient } from '../api/client';
import { keys } from '../api/keys';
import type { VendorSession } from '../api/queries';
import { STORAGE } from '../config';
import { RequireAccount, RequireVendor } from './guards';
import { TabsLayout } from './TabsLayout';

// Each screen is its own chunk, so the first load on a village 4G connection stays small.
const LoginPage = lazy(() => import('../features/auth/LoginPage'));
const WelcomePage = lazy(() => import('../features/auth/WelcomePage'));
const RegisterPage = lazy(() => import('../features/auth/RegisterPage'));
const SetPasswordPage = lazy(() => import('../features/auth/SetPasswordPage'));
const HomePage = lazy(() => import('../features/home/HomePage'));
const OrderPage = lazy(() => import('../features/orders/OrderPage'));
const BillPage = lazy(() => import('../features/orders/BillPage'));
const PayPage = lazy(() => import('../features/orders/PayPage'));
const CodePage = lazy(() => import('../features/orders/CodePage'));
const StockPage = lazy(() => import('../features/stock/StockPage'));
const ProductEditPage = lazy(() => import('../features/stock/ProductEditPage'));
const CatalogPage = lazy(() => import('../features/stock/CatalogPage'));
const SlotsPage = lazy(() => import('../features/slots/SlotsPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'));

const page = (el: React.ReactNode) => <Suspense fallback={<Spinner />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    // A crash in any screen shows a friendly reload screen instead of a stack trace.
    errorElement: <CrashScreen />,
    children: [
      { path: '/login', element: page(<LoginPage />) },
      {
        element: <RequireAccount />,
        children: [
          { path: '/welcome', element: page(<WelcomePage />) },
          { path: '/register', element: page(<RegisterPage />) },
        ],
      },
      {
        element: <RequireVendor />,
        children: [
          {
            element: <TabsLayout />,
            children: [
              { path: '/', element: page(<HomePage />) },
              { path: '/stock', element: page(<StockPage />) },
              { path: '/slots', element: page(<SlotsPage />) },
              { path: '/dashboard', element: page(<DashboardPage />) },
              { path: '/profile', element: page(<ProfilePage />) },
            ],
          },
          { path: '/set-password', element: page(<SetPasswordPage />) },
          { path: '/order/:date/:id', element: page(<OrderPage />) },
          { path: '/order/:date/:id/bill', element: page(<BillPage />) },
          { path: '/order/:date/:id/pay', element: page(<PayPage />) },
          { path: '/order/:date/:id/code', element: page(<CodePage />) },
          { path: '/stock/new', element: page(<ProductEditPage />) },
          { path: '/stock/catalog', element: page(<CatalogPage />) },
          { path: '/stock/:id', element: page(<ProductEditPage />) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  // Keep the account's language in sync so push notifications arrive in the same language.
  const onLang = useCallback((l: Lang) => {
    const s = queryClient.getQueryData<VendorSession>(keys.session);
    if (s?.user) void api.put('/v1/vendor/language', { lang: l }).catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      {/* Vendors get Hindi by default (project rule). */}
      <I18nProvider storageKey={STORAGE.lang} defaultLang="hi" onChange={onLang}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
