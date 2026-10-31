import { QueryClient } from '@tanstack/react-query';
import { ApiError, adoptSessionFromUrl, createApiClient } from '@rozbazaar/web';
import { API_URL, STORAGE } from '../config';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Never retry auth/validation/business errors; retry network blips twice.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

// Back from a Google login with the session in the fragment (header sessions): keep it.
adoptSessionFromUrl(STORAGE.session);

export const api = createApiClient(API_URL, {
  sessionKey: STORAGE.session,
  onUnauthenticated: () => void queryClient.invalidateQueries({ queryKey: ['session'] }),
});
