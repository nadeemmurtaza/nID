-- "Privacy 1st": the verified real name is never public unless the owner
-- opts in — defaults false, same as every other contact-channel show*
-- flag on this table.
ALTER TABLE "Profile" ADD COLUMN "showRealName" BOOLEAN NOT NULL DEFAULT false;
