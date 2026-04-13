-- Local dev runs on postgres:16-alpine without pg_cron package.
-- pg_cron is configured in staging/production infrastructure, not here.
SELECT 'init complete (pg_cron skipped in local dev)' AS status;
