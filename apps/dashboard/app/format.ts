import type { Subject } from '../lib/api-client';

/** "Alice Khan" from givenName/familyName, falling back to phone/email/id. */
export function subjectName(subject: Subject): string {
  const joined = [subject.givenName, subject.familyName].filter(Boolean).join(' ').trim();
  if (joined) return joined;
  return subject.phone ?? subject.email ?? subject.id;
}
