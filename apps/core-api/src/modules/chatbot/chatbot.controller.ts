import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { ServerResponse } from 'node:http';

import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/user.decorator';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat.dto';
import { SaveChatbotConfigDto } from './dto/save-config.dto';


@UseGuards(AuthGuard)
@Controller('chatbot')
export class ChatbotController {

  constructor(@Inject(ChatbotService) private readonly chatbotService: ChatbotService) {}


  @Get('config')
  getConfig(@CurrentUser() user: { userId: string }) {

    return this.chatbotService.getConfig(user.userId);
  }


  @Put('config')
  saveConfig(
    @CurrentUser() user: { userId: string },
    @Body() dto: SaveChatbotConfigDto,
  ) {

    return this.chatbotService.saveConfig(user.userId, dto);
  }


  @Delete('config')
  @HttpCode(204)
  async deleteConfig(@CurrentUser() user: { userId: string }): Promise<void> {

    await this.chatbotService.deleteConfig(user.userId);
  }


  @Post('config/test')
  testConnection(@CurrentUser() user: { userId: string }) {

    return this.chatbotService.testConnection(user.userId);
  }


  @Post('chat')
  async chat(
    @CurrentUser() user: { userId: string },
    @Body() dto: ChatRequestDto,
    @Res() reply: { raw: ServerResponse },
  ): Promise<void> {

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {

      for await (const token of this.chatbotService.chat(user.userId, dto.messages)) {

        reply.raw.write(`data: ${JSON.stringify({ delta: token })}\n\n`);
      }

      reply.raw.write('event: done\ndata: {}\n\n');
    } catch (err) {

      const message = err instanceof Error ? err.message : 'Unknown error';
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    } finally {

      reply.raw.end();
    }
  }
}
