-- S2-07: chat SSE shared bus.
-- An AFTER INSERT trigger on order_comments emits pg_notify('chat_events', {ids})
-- so every API replica's single LISTEN connection can fan the new comment out to
-- its local SSE subscribers. The notify is bound to the committed INSERT (can't
-- be skipped or bypassed by any write path) and carries IDs only (payload < 8KB).
-- Not modeled in schema.prisma — `prisma migrate diff` stays empty (triggers are
-- out-of-band DB objects); idempotent so re-running is safe.

BEGIN;

CREATE OR REPLACE FUNCTION notify_order_comment() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'chat_events',
    json_build_object(
      'orderId', NEW."orderId",
      'commentId', NEW.id,
      'authorId', NEW."authorId",
      'isInternal', NEW."isInternal",
      'createdAt', NEW."createdAt"
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_comments_notify ON "order_comments";
CREATE TRIGGER order_comments_notify
  AFTER INSERT ON "order_comments"
  FOR EACH ROW EXECUTE FUNCTION notify_order_comment();

COMMIT;
