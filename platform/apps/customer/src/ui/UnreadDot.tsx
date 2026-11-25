import { useNotifications } from '../api/queries';
import { useMe } from '../state/useMe';

/** The red dot on 🔔 when something is unread. */
export function UnreadDot() {
  const { loggedIn } = useMe();
  const n = useNotifications(loggedIn);
  const unread = (n.data ?? []).some((x) => !x.isRead);
  return <i className="nbdg" hidden={!unread} />;
}
