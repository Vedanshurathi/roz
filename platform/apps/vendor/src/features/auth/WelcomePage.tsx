import { Navigate } from 'react-router';
import { ErrorState, Spinner, storage, useI18n } from '@rozbazaar/web';
import { usePasswordStatus, useSession } from '../../api/queries';
import { STORAGE } from '../../config';

/**
 * Where Google login lands. New people finish registration; vendors without an app password are
 * asked to make one (so next time they can log in with phone + password); everyone else goes home.
 */
export default function WelcomePage() {
  const { t } = useI18n();
  const session = useSession();
  const isVendor = Boolean(session.data?.user);
  const pw = usePasswordStatus(isVendor);
  if (session.isPending || (isVendor && pw.isPending))
    return <Spinner label={t('Opening…', 'खुल रहा है…')} />;
  if (session.isError)
    return <ErrorState message={session.error.message} onRetry={() => session.refetch()} />;
  if (!isVendor) return <Navigate to="/register" replace />;
  if (pw.data && !pw.data.hasPassword && !storage.get(STORAGE.passwordLater))
    return <Navigate to="/set-password" replace />;
  return <Navigate to="/" replace />;
}
