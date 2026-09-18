-- Profile.usernameSetAt: when the CURRENT slug was set — the 7-day
-- reconsideration / permanent-lock math is computed live from this
-- timestamp (see Profile's own schema.prisma comment and
-- ProfilesService), never a separately stored "isLocked" boolean.
ALTER TABLE "Profile" ADD COLUMN "usernameSetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
