-- One active appointment per profile and start time. The original constraint
-- ignored status, so a cancelled appointment blocked its slot forever even
-- though availability and booking treat cancelled slots as free.
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_profileId_startsAt_key";
DROP INDEX IF EXISTS "Appointment_profileId_startsAt_key";
CREATE UNIQUE INDEX "Appointment_profileId_startsAt_active_key"
  ON "Appointment" ("profileId", "startsAt") WHERE status <> 'CANCELLED';
