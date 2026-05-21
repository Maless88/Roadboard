import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsString, ValidateNested } from 'class-validator';


export class ChatMessageDto {

  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @IsString()
  content!: string;
}


export class ChatRequestDto {

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}
