-- Records the slugified verified name the CURRENT slug was derived from,
-- so a later rename request can distinguish "the verified name genuinely
-- changed since this slug was locked in" from "same name, window just
-- hasn't closed yet" (see ProfilesService's govt-rename-unlock logic).
ALTER TABLE "Profile" ADD COLUMN "usernameSourceName" TEXT NOT NULL DEFAULT '';
