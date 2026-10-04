-- Block 2 — multi-agency session (P4 / ADR-004).
-- Persist a multi-agency staffer's chosen active agency across token refresh.
-- Soft preference (no FK): always re-validated against current agency_members at
-- login/refresh/switch, so a dangling value falls back to the first membership.
ALTER TABLE "profiles" ADD COLUMN "lastActiveAgencyId" TEXT;
