import { lazy, Suspense, useCallback } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { CrashScreen, I18nProvider } from '@rozbazaar/web';
import type { Lang } from '@rozbazaar/shared';
import { api, queryClient } from '../api/client';
import { STORAGE } from '../config';
import { ShopProvider } from '../state/shop';
import { UIProvider } from '../state/ui';
import { ToastProvider } from '../ui/Toast';
import { Layout } from './Layout';
import HomeScreen from '../screens/Home';

// Home is in the first download; every other screen is its own small chunk (village 4G).
const CatScreen = lazy(() => import('../screens/Cat'));
const SearchScreen = lazy(() => import('../screens/Search'));
const SlotScreen = lazy(() => import('../screens/Slot'));
const BasketScreen = lazy(() => import('../screens/Basket'));
const LoginScreen = lazy(() => import('../screens/Login'));
const AddressScreen = lazy(() => import('../screens/Address'));
const SuccessScreen = lazy(() => import('../screens/Success'));
const BookingsScreen = lazy(() => import('../screens/Bookings'));
const BillScreen = lazy(() => import('../screens/Bill'));
const RateScreen = lazy(() => import('../screens/Rate'));
const AccountScreen = lazy(() => import('../screens/Account'));
const HowScreen = lazy(() => import('../screens/How'));
const ContactScreen = lazy(() => import('../screens/Contact'));

const page = (el: React.ReactNode) => <Suspense fallback={<div className="scr on" />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    // A crash in any screen shows a friendly reload screen instead of a stack trace.
    errorElement: <CrashScreen />,
    element: <Layout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/cat/:type', element: page(<CatScreen />) },
      { path: '/search', element: page(<SearchScreen />) },
      { path: '/slot', element: page(<SlotScreen />) },
      { path: '/basket', element: page(<BasketScreen />) },
      { path: '/login', element: page(<LoginScreen />) },
      { path: '/address/new', element: page(<AddressScreen />) },
      { path: '/address/:id', element: page(<AddressScreen />) },
      { path: '/success', element: page(<SuccessScreen />) },
      { path: '/bookings', element: page(<BookingsScreen />) },
      { path: '/bill/:id', element: page(<BillScreen />) },
      { path: '/rate/:id', element: page(<RateScreen />) },
      { path: '/account', element: page(<AccountScreen />) },
      { path: '/how', element: page(<HowScreen />) },
      { path: '/contact', element: page(<ContactScreen />) },
      // older links (push notifications sent before the switch, bookmarks)
      { path: '/orders', element: <Navigate to="/bookings" replace /> },
      { path: '/index.html', element: <Navigate to="/" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  // Keep the account's language in sync so push notifications arrive in the same language.
  const onLang = useCallback((l: Lang) => {
    document.documentElement.lang = l;
    const s = queryClient.getQueryData<{ authenticated: boolean }>(['session']);
    if (s?.authenticated) void api.put('/v1/customer/language', { lang: l }).catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider storageKey={STORAGE.lang} defaultLang="en" onChange={onLang}>
        <ToastProvider>
          <ShopProvider>
            <UIProvider>
              <RouterProvider router={router} />
            </UIProvider>
          </ShopProvider>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
