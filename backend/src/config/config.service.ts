import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get() {
    this.logger.log('[Config] Buscando configurações');
    let config = await this.prisma.storeConfig.findFirst();
    if (!config) {
      config = await this.prisma.storeConfig.create({
        data: { id: 'default', storeName: 'Claudia Cakes' },
      });
    }
    return config;
  }

  async update(data: {
    storeName?: string; welcomeMessage?: string;
    orderConfirmMessage?: string; pixKey?: string; whatsappNumber?: string;
  }) {
    this.logger.log('[Config] Atualizando configurações');
    const config = await this.prisma.storeConfig.findFirst();
    const id = config?.id ?? 'default';
    return this.prisma.storeConfig.upsert({
      where: { id },
      update: data,
      create: { id, storeName: 'Claudia Cakes', ...data },
    });
  }
}