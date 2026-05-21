import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';


export const CHATBOT_PROVIDERS = ['openai', 'anthropic', 'ollama'] as const;
export type ChatbotProviderName = (typeof CHATBOT_PROVIDERS)[number];


export class SaveChatbotConfigDto {

  @IsIn(CHATBOT_PROVIDERS)
  provider!: ChatbotProviderName;

  @IsOptional()
  @IsString()
  @MinLength(1)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  ollamaBaseUrl?: string;

  @IsString()
  @MinLength(1)
  modelName!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
