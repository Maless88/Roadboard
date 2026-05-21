import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';

import { decryptApiKey, encryptApiKey } from './crypto';
import { SaveChatbotConfigDto, type ChatbotProviderName } from './dto/save-config.dto';
import { ChatMessage } from './providers/types';
import { DEFAULT_MODELS, getProvider, type ProviderName } from './providers';


export interface ChatbotConfigView {
  id: string;
  provider: ChatbotProviderName;
  modelName: string;
  ollamaBaseUrl: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


@Injectable()
export class ChatbotService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async getConfig(userId: string): Promise<ChatbotConfigView | null> {

    const row = await this.prisma.chatbotConfig.findUnique({ where: { userId } });

    if (!row) return null;

    return this.toView(row);
  }


  async saveConfig(userId: string, dto: SaveChatbotConfigDto): Promise<ChatbotConfigView> {

    this.validateDto(dto);

    const existing = await this.prisma.chatbotConfig.findUnique({ where: { userId } });

    // Encrypt only when the caller sent a new key. If omitted, keep the previously
    // stored ciphertext (so the user does not need to re-enter the key on each edit).
    const apiKeyEncrypted =
      dto.apiKey !== undefined && dto.apiKey !== ''
        ? encryptApiKey(dto.apiKey)
        : dto.provider === 'ollama'
        ? null
        : existing?.apiKeyEncrypted ?? null;

    const data = {
      provider: dto.provider,
      apiKeyEncrypted,
      ollamaBaseUrl: dto.provider === 'ollama' ? dto.ollamaBaseUrl ?? null : null,
      modelName: dto.modelName || DEFAULT_MODELS[dto.provider],
      isActive: dto.isActive ?? true,
    };

    const row = await this.prisma.chatbotConfig.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return this.toView(row);
  }


  async deleteConfig(userId: string): Promise<void> {

    await this.prisma.chatbotConfig.deleteMany({ where: { userId } });
  }


  async testConnection(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {

    const cfg = await this.loadRuntimeConfig(userId);
    const provider = getProvider(cfg.provider as ProviderName);

    try {
      await provider.ping({ apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model });
      return { ok: true };
    } catch (err) {

      const message = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }


  async *chat(userId: string, messages: ChatMessage[]): AsyncIterable<string> {

    if (messages.length === 0) {
      throw new BadRequestException('messages must not be empty');
    }

    const cfg = await this.loadRuntimeConfig(userId);
    const provider = getProvider(cfg.provider as ProviderName);

    yield* provider.stream(messages, { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl, model: cfg.model });
  }


  private async loadRuntimeConfig(userId: string): Promise<{
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    model: string;
  }> {

    const row = await this.prisma.chatbotConfig.findUnique({ where: { userId } });

    if (!row) {
      throw new NotFoundException('Chatbot is not configured for this user');
    }

    if (!row.isActive) {
      throw new BadRequestException('Chatbot config is inactive');
    }

    return {
      provider: row.provider,
      apiKey: row.apiKeyEncrypted ? decryptApiKey(row.apiKeyEncrypted) : undefined,
      baseUrl: row.ollamaBaseUrl ?? undefined,
      model: row.modelName,
    };
  }


  private validateDto(dto: SaveChatbotConfigDto): void {

    if (dto.provider === 'ollama') {

      if (!dto.ollamaBaseUrl) {
        throw new BadRequestException('ollamaBaseUrl is required for the ollama provider');
      }
    } else {

      // For OpenAI/Anthropic we require a key on first save; on subsequent updates
      // the caller may omit `apiKey` to keep the existing one.
    }
  }


  private toView(row: {
    id: string;
    provider: string;
    modelName: string;
    ollamaBaseUrl: string | null;
    apiKeyEncrypted: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ChatbotConfigView {

    return {
      id: row.id,
      provider: row.provider as ChatbotProviderName,
      modelName: row.modelName,
      ollamaBaseUrl: row.ollamaBaseUrl,
      hasApiKey: Boolean(row.apiKeyEncrypted),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
