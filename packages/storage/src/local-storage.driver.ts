import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { PutDocumentInput, StorageDriver, StoredDocument } from './types';

/**
 * Writes uploaded document/selfie bytes to a directory on disk. Real,
 * working storage for local development and single-host deployments — not a
 * stub. Every key is scoped under the owning tenant and method attempt, both
 * of which are server-derived (never a client-supplied path), so one
 * tenant's uploads can't collide with or overwrite another's.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';

  constructor(private readonly root: string) {}

  async put(input: PutDocumentInput): Promise<StoredDocument> {
    const key = buildKey(input.tenantId, input.methodAttemptId, input.filename);
    const target = this.resolveKey(key);

    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, input.body);

    return { key, size: input.body.byteLength, contentType: input.contentType };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  /**
   * Resolves a key to an absolute path, refusing anything that escapes the
   * storage root — a key like "../../etc/passwd" must not be readable or
   * writable, even though keys are server-generated today.
   */
  private resolveKey(key: string): string {
    const target = resolve(this.root, normalize(key));
    if (target !== this.root && !target.startsWith(this.root + sep)) {
      throw new Error(`Refusing to access a path outside the storage root: ${key}`);
    }
    return target;
  }
}

/** tenant_1 + attempt_1 + "selfie.jpg" -> "tenant_1/attempt_1/a1b2c3d4.jpg" */
function buildKey(tenantId: string, methodAttemptId: string, filename: string): string {
  const extension = extname(filename).toLowerCase().slice(0, 10);
  const unique = randomBytes(8).toString('hex');
  return `${tenantId}/${methodAttemptId}/${unique}${extension}`;
}
