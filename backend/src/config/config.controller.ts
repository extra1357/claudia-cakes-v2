import { Controller, Get, Put, Body, Logger } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('config')
export class StoreConfigController {
  private readonly logger = new Logger(StoreConfigController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get()
  get() {
    this.logger.log('[Config] GET /config');
    return this.configService.get();
  }

  @Put()
  update(@Body() body: any) {
    this.logger.log('[Config] PUT /config');
    return this.configService.update(body);
  }
}