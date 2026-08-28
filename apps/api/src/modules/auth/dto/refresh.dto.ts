import { IsString, Length } from 'class-validator';

export class RefreshDto {
  /** 32 bytes en hex. */
  @IsString()
  @Length(64, 64)
  refreshToken!: string;
}
