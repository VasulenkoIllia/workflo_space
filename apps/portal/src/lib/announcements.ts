/** ANNOUNCEMENTS (07-В): читацька сторона — @workflo/app-core (R5, аудит r6).
 * Тонкий shim за старим шляхом, щоб call-sites не мінялись (AR-42 патерн). */
export {
  AnnouncementBanner,
  useActiveAnnouncements,
  useReadAnnouncement,
  type ActiveAnnouncement,
} from '@workflo/app-core'
