/**
 * Minimal env access with fail-fast validation on boot — no framework
 * dependency, deliberately, since this runs before Nest's DI container
 * exists. Extend with a proper schema (zod/class-validator) once the env
 * surface grows past Phase 0.
 */
export interface AppEnv {
  apiPort: number;
  appDatabaseUrl: string;
  verificationMethods: string;
  otpSmsDevMode: boolean;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function loadEnv(): AppEnv {
  return {
    apiPort: Number(process.env['API_PORT'] ?? 4000),
    appDatabaseUrl: required('APP_DATABASE_URL'),
    verificationMethods: process.env['VERIFICATION_METHODS'] ?? '',
    otpSmsDevMode: process.env['OTP_SMS_DEV_MODE'] === 'true',
  };
}
