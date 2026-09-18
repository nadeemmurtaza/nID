/**
 * Extension point for where uploaded document/selfie/profile-image bytes
 * actually live. Mirrors erp-1's StorageDriver pattern
 * (docs/HOUSE-RULES.md rule 1): one interface, one class per backend,
 * selected by config — never a branch at the call site. `local` (the only
 * implementation so far) is real, working disk storage for dev/single-host
 * use; an S3-compatible driver is the documented follow-up for anything
 * beyond one host, since apps/api (which writes an upload) and
 * apps/workflows (which reads a KYC upload back inside an Activity) are
 * separate processes that only share a local disk by coincidence of both
 * pointing at the same LOCAL_STORAGE_DIR today.
 *
 * `namespace`/`groupId` are deliberately domain-neutral — this driver has
 * no idea what a Tenant or a Profile is, only that keys need two levels of
 * grouping so one caller's uploads can't collide with or overwrite
 * another's. apps/api's verification-cases module passes
 * (tenantId, methodAttemptId); its profiles/booking module passes
 * (profileId, imageKind) for ProfileImage — same driver, same interface,
 * no fork.
 */
export interface PutDocumentInput {
  namespace: string;
  groupId: string;
  filename: string;
  contentType: string;
  body: Buffer;
}

export interface StoredDocument {
  /** Opaque key to persist on DocumentAsset.storageKey — not a URL. */
  key: string;
  size: number;
  contentType: string;
}

export interface StorageDriver {
  readonly name: string;
  put(input: PutDocumentInput): Promise<StoredDocument>;
  get(key: string): Promise<Buffer>;
}
