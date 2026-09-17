import { IsOptional, IsString } from 'class-validator';

/**
 * `phone` is the only method-specific input a policy can need at creation
 * time — otp_sms sends to it immediately; document_ocr and liveness have
 * nothing to send yet, the subject's next step is an upload, handled later
 * by the document/liveness submit endpoints. Required only when the named
 * policy's methods include otp_sms — see VerificationCasesService.create().
 */
export class CreateVerificationCaseDto {
  @IsString()
  subjectId!: string;

  @IsString()
  policyName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
