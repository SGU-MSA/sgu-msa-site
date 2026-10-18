import { NotificationsMenu } from "./NotificationsMenu";
import { readNotifications } from "./read-notifications";

/**
 * The bell in every dashboard page's header (review fixes P1, item 5): the
 * notifications worked out on this load from current state, so a fixed
 * problem is gone on the next page. Signed out: no bell.
 */
export async function NotificationBell() {
  const notifications = await readNotifications();
  return notifications ? (
    <NotificationsMenu notifications={notifications} />
  ) : null;
}
