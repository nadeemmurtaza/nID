'use client';

import { useEffect } from 'react';
import { installFormGuard } from './formGuard';

/** Mount once in the root layout: every form in the app is validated on submit. */
export function FormGuard() {
  useEffect(() => installFormGuard(), []);
  return null;
}
