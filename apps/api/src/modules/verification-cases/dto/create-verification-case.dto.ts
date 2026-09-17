import { IsString } from 'class-validator';

/**
 * Phase 0 only has one provider (otp_sms), so this DTO is shaped around it
 * directly rather than a generic `input: Record<string, unknown>` bag.
 * Phase 1 (document_ocr, liveness) is what forces this to generalize —
 * don't build that generalization ahead of the second method, per the
 * house style against premature abstraction.
 */
export class CreateVerificationCaseDto {
  @IsString()
  subjectId!: string;

  @IsString()
  policyName!: string;

  @IsString()
  phone!: string;
}
