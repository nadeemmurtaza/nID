import { IsString, Length } from 'class-validator';

/** The code a real physical letter carried — see AddressPostalOtpProvider. */
export class SubmitCodeDto {
  @IsString()
  @Length(1, 32)
  code!: string;
}
