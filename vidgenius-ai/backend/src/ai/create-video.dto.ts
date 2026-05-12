import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  topic: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  videoModel?: string;

  @IsString()
  @IsOptional()
  orientation?: '16:9' | '9:16';
}