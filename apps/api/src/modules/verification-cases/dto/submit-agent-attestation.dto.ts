import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * A tenant agent's direct attestation after physically inspecting the
 * subject's ORIGINAL documents — see AgentAttestedCheckProvider. Reached
 * only through a tenant API-key-authenticated route, never the subject's
 * own session token: the agent is the one submitting this, not the subject.
 */
export class SubmitAgentAttestationDto {
  @IsIn(['PASSED', 'FAILED'])
  decision!: 'PASSED' | 'FAILED';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
