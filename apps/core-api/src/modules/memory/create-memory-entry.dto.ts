import { MemoryEntryType } from '@roadboard/domain';


export class CreateMemoryEntryDto {
  projectId!: string;
  type!: MemoryEntryType;
  title!: string;
  body?: string;
}
