import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
    this.logger.log("PrismaService inicializado");
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("✅ Conectado ao banco de dados");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}