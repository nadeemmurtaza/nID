import { IsNumber, Max, Min } from 'class-validator';

/** The subject's device-reported current location — see AddressGpsMatchProvider. */
export class SubmitLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
