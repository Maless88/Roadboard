import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MemoryEntryType } from '@roadboard/domain';


export class CreateMemoryEntryDto {

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
