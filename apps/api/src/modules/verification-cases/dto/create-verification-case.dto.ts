import { IsOptional, IsString } from 'class-validator';

/**
 * The only method-specific inputs a policy can need at creation time:
 * `phone` (otp_sms sends to it immediately) and `referenceId` (the student
 * ID / employee ID / other identifier education_registry or
 * employment_registry looks up immediately, since those resolve
 * synchronously with nothing for the subject to upload — see
 * RegistryCheckProvider). document_ocr, liveness, and the per-claim
 * document methods have nothing to send yet; the subject's next step is an
 * upload, handled later by the submit endpoints. Required only when the
 * named policy's methods actually need it — see VerificationCasesService.create().
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
}
