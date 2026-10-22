import { IsString, MaxLength, MinLength } from 'class-validator';

/** The subject's typed-in reply from a government SMS shortcode — see SelfReportedCheckProvider. */
export class SubmitSelfReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reportedValue!: string;
}
