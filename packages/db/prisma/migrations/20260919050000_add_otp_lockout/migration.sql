-- Per-code wrong-guess counter, closing an unthrottled OTP brute-force
-- path: Account.phone was the sole identity binding and verifyOtp() had
-- no attempt limit at all (accounts.service.ts) — a 6-digit code left
-- guessable for its full 10-minute TTL. See accounts.service.ts.
ALTER TABLE "AccountOtpCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
