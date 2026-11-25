import { useSession } from '../api/queries';

/** The logged-in customer (or null), and whether their name + phone are still missing. */
export function useMe() {
  const s = useSession();
  const me = s.data?.authenticated ? s.data.user : null;
  const loggedIn = Boolean(s.data?.authenticated);
  const needsProfile = loggedIn && (!me?.name?.trim() || !me?.phone?.trim());
  const initial = me?.name?.trim()?.[0]?.toUpperCase() ?? null;
  return { me, loggedIn, needsProfile, initial, pending: s.isPending };
}
