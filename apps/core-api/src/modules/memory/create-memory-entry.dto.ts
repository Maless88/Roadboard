import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MemoryEntryType } from '@roadboard/domain';


export class CreateMemoryEntryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsEnum(MemoryEntryType)
  type!: MemoryEntryType;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;
}
