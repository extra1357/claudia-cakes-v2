import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { StoreConfigController } from './config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ConfigService],
  controllers: [StoreConfigController],
})
export class StoreConfigModule {}