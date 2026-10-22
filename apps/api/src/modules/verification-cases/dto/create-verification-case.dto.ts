import { IsOptional, IsString } from 'class-validator';

/**
 * The only method-specific inputs a policy can need at creation time:
 * `phone` (otp_sms sends to it immediately; estamp_registry also reuses it
 * — the same real-world "phone number" field, just consumed differently:
 * otp_sms sends a code to it, estamp_registry asks the registry to confirm
 * it's the one on file), `referenceId` (the student ID / employee ID /
 * bank account number-or-IBAN / CNIC education_registry, employment_registry,
 * bank_account_title, estamp_registry, or business_registry (a company/business
 * registration number) looks up immediately, since those
 * resolve synchronously with nothing for the subject to upload — see
 * RegistryCheckProvider), `accountTitle` (bank_account_title only — the
 * claimed account-holder name for the vendor to compare its own records
 * against; education/employment registries and estamp_registry resolve a
 * claimed identity from `referenceId` alone, so they never need it), and
 * `organizationId` (org_membership only — the Organization the subject
 * claims membership in, resolved synchronously against the real
 * Organization/OrganizationMembership graph — see
 * OrganizationMembershipProvider). document_ocr, liveness,
 * agent_in_person_document, and the per-claim document methods have
 * nothing to send yet; the subject's/agent's next step is an
 * upload/attestation, handled later by the submit endpoints. Required only
 * when the named policy's methods actually need it — see
 * VerificationCasesService.create().
 */
export class CreateVerificationCaseDto {
  @IsString()
  subjectId!: string;

  @IsString()
  policyName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  accountTitle?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}
