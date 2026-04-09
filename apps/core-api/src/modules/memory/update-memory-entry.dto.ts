import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { MemoryEntryType } from '@roadboard/domain';


export class UpdateMemoryEntryDto {

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  @IsOptional()
  @IsEnum(MemoryEntryType)
  type?: MemoryEntryType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
