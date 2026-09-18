import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum CaseResolutionDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * A human decision on a NEEDS_REVIEW case — the queue docs/PHASES.md
 * flagged as a genuine dead end (the workflow stops there correctly, but
 * nothing let staff act on it). `reason` is required, not optional: an
 * override with no rationale is exactly the kind of unaccountable decision
 * an audit trail exists to prevent.
 */
export class ResolveCaseDto {
  @IsEnum(CaseResolutionDto)
  decision!: CaseResolutionDto;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
