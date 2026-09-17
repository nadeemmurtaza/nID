import { Injectable } from '@nestjs/common';
import { LocalStorageDriver, type PutDocumentInput, type StoredDocument } from '@nid/storage';
import { loadEnv } from '../config/env';

/**
 * Front door for document/selfie storage, same shape as PrismaService: wraps
 * a plain (non-Nest) driver from @nid/storage so callers never touch a
 * driver directly. Only a local-disk driver exists today — see
 * @nid/storage's header comment for why an S3-compatible one is documented
 * future work, not a stub sitting unused here.
 */
@Injectable()
export class StorageService {
  private readonly driver: LocalStorageDriver;

  constructor() {
    this.driver = new LocalStorageDriver(loadEnv().localStorageDir);
  }

  put(input: PutDocumentInput): Promise<StoredDocument> {
    return this.driver.put(input);
  }

  get(key: string): Promise<Buffer> {
    return this.driver.get(key);
  }
}
