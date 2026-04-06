import { MemoryEntryType } from '@roadboard/domain';


export class UpdateMemoryEntryDto {
  projectId?: string;
  type?: MemoryEntryType;
  title?: string;
  body?: string;
}
