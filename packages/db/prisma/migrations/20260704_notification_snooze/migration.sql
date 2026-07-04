-- 18-Б snooze: return a notification to unread at the chosen time (lazy reset on GET).
ALTER TABLE "notifications" ADD COLUMN "snoozedUntil" TIMESTAMPTZ(3);
