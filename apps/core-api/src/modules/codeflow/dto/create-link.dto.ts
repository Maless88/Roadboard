import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';


const ENTITY_TYPES = ['task', 'decision', 'milestone', 'memory_entry'];

const LINK_TYPES = [
  'implements', 'modifies', 'fixes',
  'addresses', 'motivates', 'constrains',
  'delivers', 'describes', 'warns_about',
];


export class CreateLinkDto {

  @IsIn(ENTITY_TYPES)
  entityType!: string;

  @IsString()
  @IsNotEmpty()
  entityId!: string;

  @IsIn(LINK_TYPES)
  linkType!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
