import { Controller, Get, Post, Body, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    this.logger.log(`[Whatsapp] Verificacao webhook | mode=${mode} | token=${token}`);
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      this.logger.log('[Whatsapp] ✅ Webhook verificado com sucesso');
      return res.status(200).send(challenge);
    }
    this.logger.warn('[Whatsapp] ❌ Falha na verificacao do webhook');
    return res.status(403).send('Forbidden');
  }

  @Post('webhook')
  async receiveMessage(@Body() body: any, @Res() res: Response) {
    this.logger.log('[Whatsapp] POST /webhook recebido');
    res.status(200).send('OK');

    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];
      const contact = change?.value?.contacts?.[0];

      if (!message || message.type !== 'text') {
        this.logger.log('[Whatsapp] Mensagem ignorada — nao e texto');
        return;
      }

      const phone = message.from;
      const text = message.text.body.trim();
      const name = contact?.profile?.name ?? '';

      this.logger.log(`[Whatsapp] Mensagem recebida | phone=${phone} | texto="${text}"`);
      await this.whatsappService.processMessage(phone, text, name);
    } catch (error) {
      this.logger.error(`[Whatsapp] ❌ Erro ao processar mensagem: ${error.message}`);
    }
  }
}