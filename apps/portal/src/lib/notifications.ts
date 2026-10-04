// AR-42: canonical implementation lives in @workflo/app-core (shared portal + workspace).
export {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  notifKind,
  KIND_LABEL,
  KIND_ICON,
  isSystemKind,
  notifLinkId,
} from '@workflo/app-core'
export type { Notification, NotificationsResult, NotifKind } from '@workflo/app-core'
