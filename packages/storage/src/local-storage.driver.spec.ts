import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageDriver } from './local-storage.driver';

describe('LocalStorageDriver', () => {
  let root: string;
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'nid-storage-'));
    driver = new LocalStorageDriver(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes through put() and get()', async () => {
    const body = Buffer.from('fake jpeg bytes');
    const stored = await driver.put({
      namespace: 'tenant_1',
      groupId: 'attempt_1',
      filename: 'selfie.jpg',
      contentType: 'image/jpeg',
      body,
    });

    expect(stored.key).toMatch(/^tenant_1\/attempt_1\/[a-f0-9]{16}\.jpg$/);
    expect(stored.size).toBe(body.byteLength);

    const readBack = await driver.get(stored.key);
    expect(readBack.equals(body)).toBe(true);
  });

  it('scopes different attempts to different keys', async () => {
    const a = await driver.put({
      namespace: 'tenant_1',
      groupId: 'attempt_1',
      filename: 'a.jpg',
      contentType: 'image/jpeg',
      body: Buffer.from('a'),
    });
    const b = await driver.put({
      namespace: 'tenant_1',
      groupId: 'attempt_2',
      filename: 'b.jpg',
      contentType: 'image/jpeg',
      body: Buffer.from('b'),
    });

    expect(a.key).not.toBe(b.key);
  });

  it('refuses a key that escapes the storage root', async () => {
    await expect(driver.get('../../etc/passwd')).rejects.toThrow(/outside the storage root/);
  });
});
