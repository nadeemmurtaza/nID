'use client';

import { useEffect } from 'react';
// Named differently from this file (not just by case) -- 'formGuard.ts' and
// 'FormGuard.tsx' collide on a case-insensitive filesystem (Windows,
// default macOS), and module resolution for the extension-less specifier
// './formGuard' picked whichever file case-folding landed on, not
// necessarily this one.
import { installFormGuard } from './form-guard-logic';

/** Mount once in the root layout: every form in the app is validated on submit. */
export function FormGuard() {
  useEffect(() => installFormGuard(), []);
  return null;
}
