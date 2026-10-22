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
  /** Base URL of apps/verify-ui — used to build the hostedUrl a tenant redirects subjects to. */
  verifyUiUrl: string;
  /** How long a VerificationSession token is valid for before the hosted flow refuses it. */
  sessionTtlMinutes: number;
  /**
   * Directory the local-disk StorageDriver writes document/selfie uploads
   * to. Must be absolute — apps/api and apps/workflows run from different
   * working directories, so a relative path would resolve to two different
   * places and apps/workflows could never read back an upload. See
   * @nid/storage's header comment for why that's a dev/single-host
   * constraint, not a production one.
   */
  localStorageDir: string;
  /** document_ocr provider (dev): mock an OCR result instead of calling a real vendor. */
  documentOcrDevMode: boolean;
  /** liveness provider (dev): mock a liveness result instead of calling a real vendor. */
  livenessDevMode: boolean;
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
    verifyUiUrl: process.env['VERIFY_UI_URL'] ?? 'http://localhost:3100',
    sessionTtlMinutes: Number(process.env['SESSION_TTL_MINUTES'] ?? 60),
    localStorageDir: required('LOCAL_STORAGE_DIR'),
    documentOcrDevMode: process.env['DOCUMENT_OCR_DEV_MODE'] === 'true',
    livenessDevMode: process.env['LIVENESS_DEV_MODE'] === 'true',
  };
}
